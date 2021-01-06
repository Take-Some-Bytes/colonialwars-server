# Colonial Wars Server Changelog
Changelog for ``colonialwars-server``.

The format is based on [Keep a Changelog][1], and this project adheres to [Semantic Versioning][2].

## [v0.2.0] - 2021-01-05
### Added:
- Added [``cors``](https://www.npmjs.com/package/cors) package to manage CORS in this application.
- Added CORS support within the application since some client-side JavaScript is going to
make requests to these servers from different domains.
- Added a class (``ErrorHandlers``) to house application error handlers.
### Removed:
- Removed the ``.handleOptions()`` method on the ``Middlewares`` class. The OPTIONS method is now
handled by the ``cors`` NPM package.
- Removed tests for ``middlewares.handleOptions()``.

## [v0.1.0] - 2020-12-30
- Initial (pre-)release.

[1]: https://keepachangelog.com/
[2]: https://semver.org

[v0.1.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/4faa6df4e70ab7239b6d7edf29d22feb026657f3
[v0.2.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/main
