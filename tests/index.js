'use strict'

const MongoClient = require('mongodb').MongoClient

const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
const chaiSubset = require('chai-subset')

chai.use(chaiSubset)
chai.should()

const stringConnection = 'mongodb://localhost:27017/lambda-mongo-crud-test'
const tableName = 'posts'

const Crud = require('./../lib/crud')

const PERMISSION = {
  list: 'posts:list',
  get: 'posts:get',
  save: 'posts:save',
  delete: 'posts:delete'
}

const ROLES = {
  base: {
    can: [
      PERMISSION.list,
      {
        name: PERMISSION.get,
        when: (params, callback) => {
          setImmediate(callback, null, params.userId === params.ownerId)
        }
      },
      {
        name: PERMISSION.save,
        when: (params, callback) => {
          setImmediate(callback, null, params.userId === params.ownerId)
        }
      }
    ]
  },
  admin: {
    can: [PERMISSION.save, PERMISSION.delete, PERMISSION.list, PERMISSION.get]
  }
}

describe('CRUD', () => {

  beforeEach((done) => {

    MongoClient.connect(stringConnection, (err, db) => {

      let collection = db.collection(tableName)
      collection.remove()
      db.close()
      done()

    })
  })

  after((done) => {
    MongoClient.connect(stringConnection, (err, db) => {

      let collection = db.collection(tableName)
      collection.remove()
      db.close()
      done()

    })
  })

  const crud = new Crud(stringConnection, tableName, {role: 'admin', _id: 123}, ROLES)
  const crudBase = new Crud(stringConnection, tableName, {role: 'base', _id: 456}, ROLES)

  it('is an instance of vehicle', () => {
    expect(crud).to.be.an.instanceof(Crud)
  })

  it('should have list method', () => {
    expect(typeof crud.list).to.be.equal('function')
  })

  it('should have get method', () => {
    expect(typeof crud.get).to.be.equal('function')
  })

  it('should have create method', () => {
    expect(typeof crud.create).to.be.equal('function')
  })

  it('should have update method', () => {
    expect(typeof crud.update).to.be.equal('function')
  })

  it('should have delete method', () => {
    expect(typeof crud.delete).to.be.equal('function')
  })

  describe('list()', () => {

    it('should return an array', (done) => {
      crud.list({}, PERMISSION.list, {}, (err, docs) => {
        expect(docs).to.be.deep.equal([])
        done()
      })
    })

    it('should return posts query', (done) => {

      let doc = {
        code: 1,
        title: 'My first post'
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {

        if (err) done(new Error(err))

        crud.list({code: 1}, PERMISSION.list, {}, (err, docs) => {
          expect(err).to.be.deep.equal(null)
          expect(docs).not.to.be.empty
          assert.equal(docs[0].title, doc.title)
          done()
        })
      })
    })

  })

  describe('paginated list()', () => {

    it('should return paginated list', (done) => {

      let doc = {
        code: 1,
        title: 'My first post'
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {
        if (err) done(new Error(err))

        crud.list({page: 1}, PERMISSION.list, {}, (err, result) => {
          expect(err).to.be.deep.equal(null)

          assert.ok(result.results)
          assert.ok(result.options)
          assert.ok(result.total)
          done()
        })
      })
    })

  })

  describe('get()', () => {

    it('should return an obj', (done) => {

      let doc = {
        code: 1,
        title: 'My first post'
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {
        if (err) done(new Error(err))

        crud.get(doc_created._id, PERMISSION.get, {},
          (err, doc) => {
            if (err) return done(err)

            assert.isObject(doc)
            assert.ok(doc.code)
            assert.ok(doc.title)
            done()
          })

      })
    })
  })

  describe('update()', () => {

    it('should update a post', (done) => {

      let doc = {
        code: 1,
        title: 'My first post'
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {
        if (err) done(new Error(err))

        let doc_update = {
          title: 'My first post modified'
        }

        crud.update(doc_created._id, doc_update, PERMISSION.save, {}, (err, result) => {
          if (err) done(new Error(err))
          expect(result.title).to.be.deep.equal('My first post modified')
          done()
        })
      })
    })
  })

  describe('remove()', () => {

    it('should remove a vehicle', (done) => {

      let doc = {
        code: 1,
        title: 'My first post'
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {
        if (err) done(new Error(err))

        crud.delete(doc_created._id, PERMISSION.delete, {}, (err, result) => {
          expect(err).to.be.deep.equal(null)
          expect(result.title).to.be.deep.equal('My first post')

          done()
        })

      })

    })
  })

  describe('user base list()', () => {


    it('should return posts query', (done) => {

      let doc = {
        code: 1,
        title: 'My first post',
        ownerId: 456
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {
        if (err) done(new Error(err))

        let doc2 = {
          code: 2,
          title: 'Not My second post',
          ownerId: 789
        }

        crud.create(doc2, PERMISSION.save, {}, (err, doc_created) => {
          if (err) done(new Error(err))

          const query = {ownerId: 456};
          crudBase.list(query, PERMISSION.list, {}, (err, docs) => {
            if (err) done(new Error(err))

            expect(err).to.be.deep.equal(null)
            expect(docs).not.to.be.empty
            assert.equal(docs[0].title, doc.title)
            done()
          })
        })
      })
    })
  })

  describe('user base get()', () => {

    it('should return my obj', (done) => {

      let doc = {
        code: 1,
        title: 'My first post',
        ownerId: 456
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {
        if (err) done(new Error(err))

        crudBase.get(doc_created._id, PERMISSION.get, {userId: 456, ownerId: doc.ownerId},
          (err, result) => {
            if (err) return done(err)

            assert.isObject(result)
            assert.ok(result.code)
            assert.ok(result.title)
            assert.equal(result.title, doc.title)
            done()
          })

      })
    })
  })

  describe('user base remove()', () => {

    it('should NOT remove a post', (done) => {

      let doc = {
        code: 1,
        title: 'My first post'
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {
        if (err) done(new Error(err))

        crudBase.delete(doc_created._id, PERMISSION.delete, {}, (err, result) => {
          expect(err).not.to.be.null

          done()
        })

      })

    })
  })

  describe('field createdAt / updatedAt', () => {

    it('should exist createdAt and updatedAt', (done) => {

      let doc = {
        code: 1,
        title: 'My first post'
      }

      crud.create(doc, PERMISSION.save, {}, (err, doc_created) => {
        if (err) done(new Error(err))

        expect(doc_created.createdAt).not.to.be.null

        let doc_update = {
          title: 'My first post modified'
        }

        crud.update(doc_created._id, doc_update, PERMISSION.save, {}, (err, result) => {
          if (err) done(new Error(err))
          expect(doc_created.updateAt).not.to.be.null
          done()
        })
      })
    })
  })
})

