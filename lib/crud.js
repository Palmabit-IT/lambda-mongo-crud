'use strict'

const RBAC = require('easy-rbac')
const MongoClient = require('mongodb').MongoClient
const errors = require('lambda-errors-formatter')
const uriParser = require('mongo-url-parser');
const options = require('./options')
const cloneDeep = require('lodash/cloneDeep')

function rbacCatch(err, callback) {
  if (err && typeof err.message === 'string') {
    return callback(errors.forbidden(err.message))
  }
  return callback(errors.internalServerError())
}

class Crud {

  constructor(stringConnection, collectionName, user, roles) {
    this.stringConnection = stringConnection
    this.collectionName = collectionName
    this.user = user
    this.rbac = new RBAC(roles)
  }

  list(query, permission, roleOptions, callback) {
    let queryClone = cloneDeep(query)
    const pagination = options.getPagination(queryClone);
    const sort = options.getSort(queryClone);
    const search = options.getSearch(queryClone);
    const projections = options.getProjections(queryClone);

    queryClone = options.clearQuery(queryClone)
    queryClone = Object.assign(queryClone, search);

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {
        const { dbName } = uriParser(this.stringConnection)
        MongoClient.connect(this.stringConnection, { useUnifiedTopology: true }, (err, client) => {

          if (err) {
            return callback(err)
          }

          const collection = client.db(dbName).collection(this.collectionName)

          collection.find(queryClone).sort(sort).project(projections).limit(pagination.limit).skip(pagination.from).toArray((err, docs) => {

            if (err) {
              client.close()
              return callback(err)
            }

            if (!pagination.isPaginated) {
              client.close()
              return callback(null, docs)
            }

            collection.countDocuments(queryClone, (err, total) => {
              client.close()

              if (err) {
                return callback(err)
              }

              return callback(null, options.getPaginatedResponse(docs, pagination, total))
            });
          })
        })
      })

      .catch(err => rbacCatch(err, callback))
  }

  listAggregate(query, stages, permission, roleOptions, callback) {

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {
        const { dbName } = uriParser(this.stringConnection)
        MongoClient.connect(this.stringConnection, { useUnifiedTopology: true }, (err, client) => {

          if (err) {
            return callback(err)
          }

          const pagination = options.getPagination(query);
          const sort = options.getSort(query);
          const search = options.getSearch(query);
          const projections = options.getProjections(query);

          query = options.clearQuery(query)
          query = Object.assign(query, search);

          const collection = client.db(dbName).collection(this.collectionName)
          collection.countDocuments(query, (err, total) => {

            if (err) {
              client.close()
              return callback(err)
            }

            stages.unshift({ $match: query })

            if (sort && Object.keys(sort).length > 0) {
              stages.push({ $sort: sort })
            }

            if (projections && Object.keys(projections).length > 0) {
              stages.push({ $project: projections })
            }

            stages = stages.concat(options.getPaginationStages(pagination));

            collection
              .aggregate(stages, { cursor: { batchSize: 1 } })
              .toArray((err, results) => {

                client.close()

                if (err) {
                  return callback(err)
                }

                if (!pagination.isPaginated) {
                  return callback(null, results);
                }

                return callback(null, options.getPaginatedResponse(results, pagination, total))
              }
              );
          });
        })
      })

      .catch(err => rbacCatch(err, callback))
  }

  get(query, permission, roleOptions, callback) {

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {
        const { dbName } = uriParser(this.stringConnection)
        MongoClient.connect(this.stringConnection, { useUnifiedTopology: true }, (err, client) => {

          if (err) {
            return callback(err)
          }

          const collection = client.db(dbName).collection(this.collectionName)

          collection.findOne(query, (err, doc) => {
            client.close()

            if (err) {
              return callback(err)
            }

            if (!doc) {
              return callback(errors.notFound())
            }

            return callback(null, doc)
          })
        })
      })

      .catch(err => rbacCatch(err, callback))
  }

  create(data, permission, roleOptions, callback) {
    const { dbName } = uriParser(this.stringConnection)
    data.createdAt = new Date();

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {

        MongoClient.connect(this.stringConnection, { useUnifiedTopology: true }, (err, client) => {

          if (err) {
            return callback(err)
          }

          const collection = client.db(dbName).collection(this.collectionName)

          collection.insertOne(data, (err, doc) => {

            client.close()

            if (err) {
              return callback(err)
            }

            return callback(null, doc.ops[0])
          })
        })

      })

      .catch(err => rbacCatch(err, callback))
  }

  delete(query, permission, roleOptions, callback) {

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {
        const { dbName } = uriParser(this.stringConnection)
        MongoClient.connect(this.stringConnection, { useUnifiedTopology: true }, (err, client) => {
          if (err) {
            return callback(err)
          }

          const collection = client.db(dbName).collection(this.collectionName)

          collection.findOneAndDelete(query, (err, doc) => {

            client.close()

            if (err) {
              return callback(err)
            }

            return callback(null, doc.value)
          })
        })
      })

      .catch((err) => rbacCatch(err, callback))
  }

  update(query, data, permission, roleOptions, callback) {

    delete data.createdAt
    data.updateAt = new Date()

    const options = {
      upsert: false,
      returnOriginal: false
    }

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {
        const { dbName } = uriParser(this.stringConnection)
        MongoClient.connect(this.stringConnection, { useUnifiedTopology: true }, (err, client) => {
          if (err) {
            return callback(err)
          }

          const collection = client.db(dbName).collection(this.collectionName)

          collection.findOneAndUpdate(query, { $set: data }, options, (err, doc) => {

            client.close()

            if (err) {
              return callback(err)
            }

            return callback(null, doc.value)
          })
        })
      })

      .catch((err) => rbacCatch(err, callback))
  }

  upsertMany(data, keyForQuery, permission, roleOptions, callback) {

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {
        const { dbName } = uriParser(this.stringConnection)
        MongoClient.connect(this.stringConnection, { useUnifiedTopology: true }, (err, client) => {
          if (err) {
            return callback(err)
          }

          const collection = client.db(dbName).collection(this.collectionName)

          const bulk = collection.initializeUnorderedBulkOp();

          for (let obj of data) {
            let query = {}
            query[keyForQuery] = obj[keyForQuery]
            bulk.find(query).upsert().updateOne({ $set: obj });
          }

          bulk.execute((err, result) => {
            client.close()

            if (err) {
              return callback(err)
            }

            return callback(null, result)
          });
        })
      })

      .catch((err) => rbacCatch(err, callback))
  }
}

module.exports = Crud
