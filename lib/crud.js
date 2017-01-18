'use strict'

const RBAC = require('easy-rbac')
const MongoClient = require('mongodb').MongoClient
const errors = require('lambda-errors-formatter')
const options = require('./options')

const errorConnectionResponse = errors.internalServerError('Internal Server Error: connection db')
const errorMongoResponse = errors.internalServerError('Internal Server Error: db error')

function rbacCatch(err, callback) {
  if (err === false) {
    return callback(errors.forbidden())
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

    const pagination = options.getPagination(query);
    const sort = options.getSort(query);
    const search = options.getSearch(query);

    query = options.clearQuery(query)
    query = Object.assign(query, search);

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {

        MongoClient.connect(this.stringConnection, (err, db) => {

          if (err) {
            return callback(errorConnectionResponse)
          }

          let collection = db.collection(this.collectionName)

          collection.find(query).sort(sort).limit(pagination.limit).skip(pagination.from).toArray((err, docs) => {

            if (err) {
              db.close()
              return callback(errorMongoResponse)
            }

            if (!pagination.isPaginated) {
              db.close()
              return callback(null, docs)
            }

            collection.count(query, (err, total) => {
              db.close()

              if (err) {
                return callback(errorMongoResponse)
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

        MongoClient.connect(this.stringConnection, (err, db) => {

          if (err) {
            return callback(errorConnectionResponse)
          }

          const pagination = options.getPagination(query);
          const sort = options.getSort(query);

          query = options.clearQuery(query)

          let collection = db.collection(this.collectionName)
          collection.count(query, (err, total) => {

            if (err) {
              db.close()
              return callback(errorMongoResponse)
            }

            stages.unshift({$match: query})

            if (sort && Object.keys(sort).length > 0) {
              stages.push({$sort: sort})
            }

            stages = stages.concat(options.getPaginationStages(pagination));

            collection.aggregate(stages, (err, results) => {

                db.close()

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

        MongoClient.connect(this.stringConnection, (err, db) => {

          if (err) {
            return callback(errorConnectionResponse)
          }

          let collection = db.collection(this.collectionName)

          collection.findOne(query, (err, doc) => {
            db.close()

            if (err) {
              return callback(errorMongoResponse)
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

    data.createdAt = new Date();

    this.rbac.can(this.user.role, permission, roleOptions)

      .then(() => {

        MongoClient.connect(this.stringConnection, (err, db) => {

          if (err) {
            return callback(errorConnectionResponse)
          }

          let collection = db.collection(this.collectionName)

          collection.insertOne(data, (err, doc) => {

            db.close()

            if (err) {
              return callback(errorMongoResponse)
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

        MongoClient.connect(this.stringConnection, (err, db) => {
          if (err) {
            return callback(errorConnectionResponse)
          }

          let collection = db.collection(this.collectionName)

          collection.findOneAndDelete(query, (err, doc) => {

            db.close()

            if (err) {
              return callback(errorMongoResponse)
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

        MongoClient.connect(this.stringConnection, (err, db) => {
          if (err) {
            return callback(errorConnectionResponse)
          }

          let collection = db.collection(this.collectionName)

          collection.findOneAndUpdate(query, {$set: data}, options, (err, doc) => {

            db.close()

            if (err) {
              return callback(errorMongoResponse)
            }

            return callback(null, doc.value)
          })
        })
      })

      .catch((err) => rbacCatch(err, callback))
  }
}

module.exports = Crud
