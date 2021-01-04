'use strict'

const MongoClient = require('mongodb').MongoClient
const muri = require('muri')
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
  admin: {
    can: [PERMISSION.save, PERMISSION.delete, PERMISSION.list, PERMISSION.get]
  }
}

describe('MANY', () => {

  before(async () => {
    const { db: dbName } = muri(stringConnection)
    const client = await MongoClient.connect(stringConnection, { useUnifiedTopology: true })
    const collection = client.db(dbName).collection(tableName)
    await collection.insertMany([{ title: "Title 1", code: 1 }, { title: "Title 2", code: 2 }, { title: "Title 3", code: 3 }])
    await client.close()
  })

  after(async () => {
    const { db: dbName } = muri(stringConnection)
    const client = await MongoClient.connect(stringConnection, { useUnifiedTopology: true })
    const collection = client.db(dbName).collection(tableName)
    await collection.deleteMany()
    await client.close()
  })

  const crud = new Crud(stringConnection, tableName, { role: 'admin', _id: 123 }, ROLES)

  describe('list()', () => {

    it('should return an array', (done) => {
      crud.list({}, PERMISSION.list, {}, (err, docs) => {
        expect(docs.length).to.be.equal(3)
        done()
      })
    })

    it('should return an array', (done) => {

      const data = [
        { title: "Title 2", code: 2 },
        { title: "Title 3bis", code: 3 },
        { title: "Title 4", code: 4 },
        { title: "Title 5", code: 5 }
      ]

      crud.upsertMany(data, "code", PERMISSION.save, {}, (err, result) => {

        expect(result.nMatched).to.be.equal(2)
        expect(result.nUpserted).to.be.equal(2)

        crud.list({}, PERMISSION.list, {}, (err, docs) => {
          expect(docs.length).to.be.equal(5)
          done()
        })
      })
    })
  })

})

