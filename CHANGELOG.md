# Colonial Wars Server Changelog
Changelog for ``colonialwars-server``.

The format is based on [Keep a Changelog][1], and this project adheres to [Semantic Versioning][2].

## [v0.5.0] - 2021-04-29
### Added:
- Added a ``TimedStore`` class, which deletes items after the specified amount of time.
- Added [``lru-cache``](https://www.npmjs.com/package/lru-cache),
which ``TimedStore`` depends on.
- Added a 6 second idle timeout for all connections made to this server. This is to prevent
the process from indefinitely hanging when we want to shut down, and it's nice for DDOS prevention
too (....probably not).
- Added a new ``GameServer`` class, which handles game updates, admissions, player input,
authorization, and the WebSocket server. This completes the connection between the game
client and game server.
- Added a ``/game-auth`` route, which clients can use to obtain authorization to enter a game.
- Added player tracking in the ``Manager`` class: it now tracks all the player's names across
all the games that ``Manager`` is managing. Subsequently, it could be used to ensure that no more
than one instance of player ``Bob`` exists on a single game server.
- Added new game configurations; now, you need to specify the game's map's theme.
### Changed:
- Renamed the ``GameServer`` class to the ``CWServer`` class, as ``CWServer`` is a more appropriate
name for what the class does.
- Moved all the stuff in ``lib/websockets`` to ``lib/cwdtp``.
- Decreased updates per second from 25/s to 10/s.
- Increased player speed from 0.4 to 0.9.
- Updated the ``WSConn`` class to conform to [CWDTP Revision 6][4].
### Removed:
- Removed logic which decided whether to log an error while parsing the ``Forwarded`` header.
Now, if an error is encountered, the header is ignored, and the next middleware is called.
- Removed all references to [``Socket.IO``](https://socket.io). We never used it in this project,
and with our current plans, we never will.

## [v0.4.3] - 2021-04-03
### Added:
- Added [``nanoid``](https://www.npmjs.com/package/nanoid) for generating WebSocket connection IDs.
- Added a ``crypto`` module to provide a unified API for Node.JS and the browser. That way, we won't
have to rewrite a lot of crypto code when we use the ``WSConn`` class in the front end.
### Changed:
- ``WSServer`` and ``WSConn`` are now fully-fledged implementations of [``CWDTP``][3], instead of
a "slight" wrapper around WebSockets.

## [v0.4.2] - 2021-03-25
### Added:
- Added a replacement for ``valley.json`` called ``plains.json``.
- Added a map description field in all map save files.
- Added some wrapper classes and utility functions to make working with ``ws`` easier.
### Changed:
- Used [``ws``](https://www.npmjs.com/package/ws) instead of Socket.IO.
- Updated the ``/game-stats`` route to send a game description.
### Removed:
- Removed ``valley.json``.

## [v0.4.1] - 2021-03-13
### Changed:
- Updated NPM lock file version.
- Updated code to work with updated map save file structures in [``specifications/colonialwars/file-structures.md``](
  https://github.com/Take-Some-Bytes/specifications/blob/6505648b28a5f8b12edfaaf2d1df603ef48debc6/colonialwars/file-structures.md
). Most notably, the way teams are specified have been changed. The old syntax for specifying
teams is still supported for compatibility reasons, 
- Updated a lot of logging in and around the game server.
### Fixed:
- Actually uploaded ``.gitignore`` to GitHub.
- Actually uploaded updated compatibility data for ``README.md`` to GitHub.
- Fixed specs for the ``Controllers`` class. The specs were still expecting the old response format,
and now they (correctly) expect the new response format.
- Fixed the links that point to the [``specifications``](https://github.com/Take-Some-Bytes/specifications)
repository. Now, they point to specific commit hashes, which is always better since the client sees
the specifications as they were at that time, instead of the latest specifications.

## [v0.4.0] - 2021-03-12
### Added:
- Added a ``.gitignore`` file so we can actually start using ``Git`` properly.
### Changed:
- Changed all game configuration files to conform to the save file structures
defined in [``specifications/colonialwars/file-structures.md``](
  https://github.com/Take-Some-Bytes/specifications/blob/8b485d772503bcc0fce802a3407b5f54a655666c/colonialwars/file-structures.md
).
- Changed player input handling. Instead of applying player velocity changes
on input, the input is pushed to a queue with a timestamp, and processed
every time the player is updated.
- Updated all game-related classes to work with the updated save file structures.
- Updated all HTTP responses to conform to the structure defined in
[``specifications/colonialwars/message-structures.md``](
  https://github.com/Take-Some-Bytes/specifications/blob/main/colonialwars/message-structure.md#http-response-body-structure
).
- Updated ``serverUtils.sendError()`` method to accept custom content types.
- Update compatibility data in ``README.md``.
### Fixed:
- Fixed the fact that no response gets sent when a CORS error is encountered.

## [v0.3.2] - 2021-02-11
### Added:
- Added ``GameLoader`` specs.
- Added a way to track clients in the ``Manager`` class.
- Added a route that returns statistics about the games running on the GameServer.
- Added a ``game/data`` folder to store game-related data, e.g. map save files
and unit data files.
### Changed:
- Started using the ``Manager`` and ``GameLoader`` classes in our backend.
- Updated compatibility data.
### Fixed:
- Fixed the fact that the ``bound-object.js`` file was ***not renamed*** to ``bound-entity.js``
in the GitHub repository.
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
[3]: https://github.com/Take-Some-Bytes/specifications/blob/5542f478975dc45480d631f314837cc571681b0a/colonialwars/pow_cwdtp.md
[4]: https://github.com/Take-Some-Bytes/specifications/blob/d8013611e60ce71d845b7d7d7d9570a05f11ca34/colonialwars/pow_cwdtp.md

[v0.1.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/4faa6df4e70ab7239b6d7edf29d22feb026657f3
[v0.2.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/db96ffa372e8791d2a1cdbf47d4b69550b0cb3d4
[v0.3.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/b4038be257524ea868baaf4cdd04893918946f8e
[v0.3.1]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/f1323f4de881d09549b9f965f7b853ebe7277c32
[v0.3.2]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/1c66e82c53ae1c64810d7068f8642ebfca1062b3
[v0.4.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/ca6c60753f6ab621059641cb8e5a79eda8acf5c4
[v0.4.1]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/cd8bb1506754564979add0c67c86d1f108a9e8a8
[v0.4.2]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/c375b8c0f2226ac94e514404dda1191fa76b8a3a
[v0.4.3]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/f083df5d5f546e2ffb261e61a38e86fc2fab4c08
[v0.5.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/main
