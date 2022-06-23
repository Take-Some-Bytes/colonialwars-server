/* eslint-env browser */
/**
 * @Fileoverview File to store schemas of configurations files.
 */

const Joi = require('joi')

const constants = require('../constants')

const { ID_REGEXP, NAME_REGEXP, MAP_CONFIG_LIMITS, REGEXP } = constants
const { DESCRIPTION_MULTI_LINE, DESCRIPTION_SINGLE_LINE } = REGEXP

const IdSchema = Joi.string().pattern(ID_REGEXP, 'id')
const NameSchema = Joi.string().pattern(NAME_REGEXP, 'name')
const MultiLineDescSchema = Joi.string().pattern(DESCRIPTION_MULTI_LINE, 'multi-line-desc')
const SingleLineDescSchema = Joi.string().pattern(DESCRIPTION_SINGLE_LINE, 'single-line-desc')
const Vector2dSchema = Joi.object({
  x: Joi.number().integer(),
  y: Joi.number().integer()
})
const StaticImgSchema = Joi.object().pattern(
  Joi.string().valid('x', 'y', 'w', 'h'),
  Joi.number().integer()
)
const DynAnimationSchema = StaticImgSchema.keys({
  frameSize: Joi.number().integer()
})
const RgbaSchema = Joi.object({
  r: Joi.number().integer().min(0).max(255),
  g: Joi.number().integer().min(0).max(255),
  b: Joi.number().integer().min(0).max(255),
  a: Joi.number().min(0).max(1)
})
const AuraSchema = Joi.object({
  modifier: IdSchema,
  range: Joi.number().positive().integer().min(1)
})
const ModificationSchema = Joi.object({
  field: Joi.string().allow(''),
  add: Joi.number().integer(),
  multiply: Joi.number().integer()
})
const TeamSchema = Joi.object({
  name: Joi
    .string()
    .max(MAP_CONFIG_LIMITS.MAX_TEAM_NAME_LEN)
    .pattern(constants.REGEXP.TEAM_NAME, 'team name'),
  description: SingleLineDescSchema.max(MAP_CONFIG_LIMITS.MAX_TEAM_DESC_LEN),
  maxPlayers: Joi
    .number()
    .integer()
    .min(MAP_CONFIG_LIMITS.MIN_PLAYERS_ON_TEAM)
    .max(MAP_CONFIG_LIMITS.MAX_PLAYERS_ON_TEAM),

  spawnPosition: Vector2dSchema
})

const PlayerDataSchema = Joi.object({
  img: Joi.string(),
  speed: Joi.number().positive()
})

const GraphicsDataSchema = Joi.object().pattern(IdSchema, Joi.object({
  id: IdSchema,
  name: NameSchema,
  file: Joi.string(),
  angles: Joi.number().integer().valid(1, 2, 4, 8),
  hasAnimations: Joi.boolean(),
  mainImg: StaticImgSchema,
  // The following three images are optional.
  damaged1Img: StaticImgSchema.allow(null).optional(),
  damaged2Img: StaticImgSchema.allow(null).optional(),
  constructing1Img: StaticImgSchema.allow(null).optional(),
  // Animations are only required if hasAnimations is true.
  animations: Joi
    .when('hasAnimations', {
      is: Joi.equal(true),
      then: Joi.object().pattern(
        Joi.string().valid(...constants.VALID_ANIMATIONS),
        DynAnimationSchema
      ),
      otherwise: Joi.any().allow(null).optional()
    })
}))

const ModifiersDataSchema = Joi.object().pattern(IdSchema, Joi.object({
  id: IdSchema,
  name: NameSchema,
  description: SingleLineDescSchema
    .allow('')
    .min(0)
    .max(MAP_CONFIG_LIMITS.MAX_MODIFIER_DESC_LEN),
  duration: Joi.number().integer(),
  maxStack: Joi.number().integer(),
  modifications: Joi
    .array()
    .items(ModificationSchema)
    .max(MAP_CONFIG_LIMITS.MAX_MODIFICATIONS_PER_MODIFIER),
  auras: Joi
    .array()
    .items(AuraSchema)
    .max(MAP_CONFIG_LIMITS.MAX_AURAS_PER_MODIFIER),
  auraHitsSelf: Joi.boolean(),
  auraHitsFriendly: Joi.boolean(),
  auraHitsAllied: Joi.boolean(),
  auraHitsEnemy: Joi.boolean(),
  auraColour: RgbaSchema,
  auraTargetFilters: Joi.array().items(Joi.string()),
  auraTargetFiltersExclude: Joi.array().items(Joi.string()),
  disableCommands: Joi.array().items(Joi.string()),
  changeEntityImg: Joi.boolean(),
  entityImg: IdSchema,
  changeAtkEffect: Joi.boolean(),
  atkEffect: Joi.string(),
  effects: Joi.array().items(Joi.string()),
  sound: Joi.string(),
  soundVolume: Joi.number().positive(),
  removeModifiers: Joi.array().items(IdSchema)
}))

const MapConfigSchema = Joi.object({
  meta: Joi.object({
    name: NameSchema,
    mode: Joi.string().valid(...constants.VALID_GAME_MODES).insensitive(),
    tileType: Joi.string().valid(...constants.VALID_TILE_TYPES),
    description: MultiLineDescSchema
      .allow('')
      .min(0)
      .max(MAP_CONFIG_LIMITS.MAX_MAP_DESC_LEN),
    unitDataExtends: Joi.string(),
    buildingDataExtends: Joi.string(),
    graphicsDataExtends: Joi.string(),
    playerDataExtends: Joi.string(),
    maxPlayers: Joi
      .number()
      .integer()
      .min(MAP_CONFIG_LIMITS.MIN_PLAYERS_MAP),
    defaultHeight: Joi
      .number()
      .integer()
      .min(MAP_CONFIG_LIMITS.MIN_DEFAULT_HEIGHT)
      .max(MAP_CONFIG_LIMITS.MAX_DEFAULT_HEIGHT),
    worldLimits: Vector2dSchema,
    teams: Joi
      .array()
      .min(MAP_CONFIG_LIMITS.MIN_TEAMS)
      .max(MAP_CONFIG_LIMITS.MAX_TEAMS)
      .items(TeamSchema)
  }),
  data: Joi.object({
    graphicsData: GraphicsDataSchema,
    modifiersData: ModifiersDataSchema,
    playerData: Joi.when(Joi.ref('...meta.playerDataExtends'), {
      is: Joi.equal('none'),
      then: PlayerDataSchema,
      otherwise: PlayerDataSchema.prefs({ presence: 'optional' })
    })
  }),
  configType: Joi.string().valid('map-config')
}).prefs({ presence: 'required', convert: false })

module.exports = {
  MapConfigSchema
}
