This folder has been auto-generated using [swagger-codegen](https://github.com/swagger-api/swagger-codegen).
We don't use the generated code since the `swagger.json` contains a lot of errors which makes the generated client unusable. However, we can reuse the generated model interfaces. We've copied them to `interfaces.ts`.

### How to regenerate the client

- Install [swagger-codegen](https://github.com/swagger-api/swagger-codegen)
- Run `swagger-codegen generate -i https://my.sevdesk.de/swaggerJSON/swagger.json -l typescript-fetch -o ./generated`