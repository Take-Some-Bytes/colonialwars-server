# Colonial Wars Server Changelog
Changelog for ``colonialwars-server``.

The format is based on [Keep a Changelog][1], and this project adheres to [Semantic Versioning][2].

## [v0.3.2] - 2021-02-11
### Added:
- Added ``GameLoader`` specs.
- Added a way to track clients in the ``Manager`` class.
- Added a route that returns statistics about the games running on the GameServer.
- Added a ``game/data`` folder to store game-related data, e.g. map save files and unit data files.
### Changed:
- Started using the ``Manager`` and ``GameLoader`` classes in our backend.
- Updated compatibility data.
### Fixed:
- Fixed the fact that the ``bound-object.js`` file was ***not renamed*** to ``bound-entity.js`` in the GitHub repository.
- Fixed the fact that all the dates in this CHANGELOG were wrong since
2020-12-30.

## [v0.3.1] - 2021-01-23
### Added:
- Added a ``GameLoader`` class to load games from configuration files.
- Added a ``Manager`` class to manage the amount of games that are running on this server.
- Added compatibility data in ``README.md``.
- Added an NPM ``check`` script that runs ``npm audit``, ``npm outdated``, and ``npm test``.
### Changed:
- Renamed the ``BoundObject`` class to the ``BoundEntity`` class.
- Updated the ``BaseGame`` class to inherit from the ``events.EventEmitter`` class.
- Updated some game-related files to take required parameters inside a ``config`` object instead
of passing them one by one.
- Updated the ``fetch`` function in ``fetch.js`` to use ``http.request`` instead of ``http.get``.
### Fixed:
- Fixed the ``RegExp`` used to check if the ``Accept`` header has the correct values. Before,
users could enter values like ``application/plain``, and it will pass. Now, ``application/plain``
will not pass.
- Fixed the ``deepFreeze`` method; before, if there was a ``NO_FREEZE`` symbol on the passed-in object's
properties, the entire function would exit.

## [v0.3.0] - 2021-01-14
### Added:
- Added utility functions to mess around with math in ``/lib/utils/math-utils.js``.
- Added many game-related files:
  * ``player.js``, to manage the player logic;
  * ``base-game.js``, a base class with all the methods and properties common
  to all game modes;
  * ``bound-object.js``, a class representing an object that is bound to a minimum and maximum; and
  * ``vector-2d.js``, a class representing a 2D vector.
### Changed:
- Changed spec naming convention--instead of using ``[name]_spec.js``, now we use ``[name].spec.js``.
- Changed all occurances of the [EM dash](https://www.thesaurus.com/e/grammar/em-dash/) to use two
hypens instead. Why? I've decided I don't want to use obscure characters in my programs, since they could
cause all sorts of problems... (An EM dash is not a valid ASCII character).
### Removed:
- Removed a lot of ``console.log``s in the specs.

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
[v0.2.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/db96ffa372e8791d2a1cdbf47d4b69550b0cb3d4
[v0.3.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/b4038be257524ea868baaf4cdd04893918946f8e
[v0.3.1]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/f1323f4de881d09549b9f965f7b853ebe7277c32
[v0.3.2]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/main
