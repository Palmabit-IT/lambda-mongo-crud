# lambda mongo crud

Crud with mongoDb-native and RBAC role/permission for AWS Lambdas

## Installation

```
npm install lambda-response --save
```

## Usage

```js
const Crud = require('lambda-mongo-crud')

const roles = {
    base: {
        can: ['posts:list','posts:get']
    },
    admin: {
        can: ['posts:save','posts:delete']
    }
}

const crud = new Crud('stringConnection','tableName','admin',roles)

const query = {}
const roleOptions = {}

crud.list(query,'posts:list',roleOptions, (err,docs) => {} )

```

## Tests
```
npm test
```

### Coverage

```
npm run-script test-travis
```

## Author

[Palmabit](https://palmabit.com)

## License

[MIT license](LICENSE)
