import * as z from 'zod'
import {
  asGalleryID,
  asMemberID,
  asPhotoID,
  type GalleryID,
  type PhotoID,
} from '../common/ID'
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../common/error'
import { isSafeFilename, thumbFilename } from '../common/image-name'
import {
  InstanceConfigUpdateSchema,
  assertInstanceConfigWithinHardLimit,
  mergeInstanceConfig,
  type InstanceConfig,
} from '../config/instance'
import { type EnvConfig } from '../config'
import {
  galleryCanSubmission,
  galleryInEvent,
  galleryPhotosSorted,
  galleryVotesForMember,
  galleryVotesForPhoto,
  memberHasSubmitted,
  type Gallery,
} from '../core/Gallery'
import { asQQNumber } from '../core/Member'
import {
  findGallery,
  findMemberById,
  findMemberByQQ,
  findPhoto,
  poolAddPhoto,
  poolAllPhotos,
  poolClearMemberGalleryVotes,
  poolCreateGallery,
  poolCreateMember,
  poolCreateEmpty,
  poolDeleteMember,
  poolGalleriesSorted,
  poolMembersSorted,
  poolRemoveGallery,
  poolRemovePhoto,
  poolSubmitPhoto,
  poolSubmitVotes,
  poolUpdateGallery,
  poolUpdateMember,
  poolUpdatePhoto,
  poolSortPhotosByVoteCount,
  poolRemoveSubmission,
  type Pool,
} from '../core/Pool'
import { type Photo } from '../core/Photo'
import type { ImagePipeline } from './prepare-photo'
import {
  galleryDto,
  memberDto,
  memberHomeDto,
  photoDto,
  publicHomeDto,
  statisticDto,
  voteDto,
  type GalleryDTO,
  type MemberDTO,
  type MemberVoteDTO,
  type PhotoDTO,
  type PublicHomeDTO,
  type StatisticDTO,
  type VoteDTO,
} from './serializers'

export type QueryContext = {
  pool: Pool
  env: EnvConfig
  config: InstanceConfig
  now: Date
}

export type MutationContext = QueryContext & {
  preparePhoto: ImagePipeline['preparePhoto']
  prepareAvatar: ImagePipeline['prepareAvatar']
  refreshThumb: ImagePipeline['refreshThumb']
  refreshAvatar: ImagePipeline['refreshAvatar']
  cleanUnusedImages: ImagePipeline['cleanUnusedImages']
}

export type QueryDef<I, O> = {
  schema: z.ZodType<I>
  admin: boolean
  run: (ctx: QueryContext, payload: I) => O
}

export type MutationOutcome<O> = {
  pool: Pool
  result: O
  instance_config?: InstanceConfig
}

export type MutationDef<I, O> = {
  schema: z.ZodType<I>
  admin: boolean
  run: (ctx: MutationContext, payload: I) => Promise<MutationOutcome<O>>
}

function defineQuery<I, O>(definition: QueryDef<I, O>): QueryDef<I, O> {
  return definition
}

function defineMutation<I, O>(definition: MutationDef<I, O>): MutationDef<I, O> {
  return definition
}

const idSchema = z.number().int().positive()
const qqSchema = z.number().int().positive()
const tempIdSchema = z.string().min(1).refine(isSafeFilename, '非法的 temp_id')
const dateSchema = z.iso.datetime()
const photoIdsSchema = z.array(idSchema).min(1)

const GalleryCreateSchema = z.object({
  name: z.string().min(1),
  index: z.number().int().nonnegative(),
  vote_limit: z.number().int().nonnegative(),
  event_start: dateSchema,
  submission_expire: dateSchema,
  event_end: dateSchema,
})

const GalleryUpdateSchema = GalleryCreateSchema.partial().strict()

const MemberCreateSchema = z.object({
  qq_num: qqSchema,
  name: z.string().min(1),
  avatar_temp_id: tempIdSchema,
})

const MemberUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  avatar_temp_id: tempIdSchema.optional(),
}).strict()

const PhotoCreateSchema = z.object({
  gallery_id: idSchema,
  member_id: idSchema,
  desc: z.string(),
  index: z.number().int().nonnegative().default(0),
  temp_id: tempIdSchema,
})

const PhotoUpdateSchema = z.object({
  gallery_id: idSchema.optional(),
  member_id: idSchema.optional(),
  desc: z.string().optional(),
  index: z.number().int().nonnegative().optional(),
  temp_id: tempIdSchema.optional(),
}).strict()

const SubmissionCreateSchema = z.object({
  gallery_id: idSchema,
  qq_num: qqSchema,
  desc: z.string(),
  temp_id: tempIdSchema,
})

const SubmissionUpdateSchema = z.object({
  photo_id: idSchema,
  qq_num: qqSchema,
  desc: z.string().optional(),
  temp_id: tempIdSchema.optional(),
})

const SubmissionCancelSchema = z.object({
  photo_id: idSchema,
  qq_num: qqSchema,
})

const VoteSchema = z.object({
  gallery_id: idSchema,
  qq_num: qqSchema,
  photo_ids: photoIdsSchema,
})

const GalleryIDPayloadSchema = z.object({ gallery_id: idSchema })
const PhotoIDPayloadSchema = z.object({ photo_id: idSchema })
const MemberIDPayloadSchema = z.object({ member_id: idSchema })
const SubmissionLookupSchema = z.object({
  gallery_id: idSchema,
  qq_num: qqSchema,
})
const MemberLookupSchema = z.object({ qq_num: qqSchema })
const EmptySchema = z.object({})

const MemberGalleryPayloadSchema = z.object({
  member_id: idSchema,
  gallery_id: idSchema,
})

const InstanceConfigUpdatePayloadSchema = InstanceConfigUpdateSchema

function toDate(value: string): Date {
  return new Date(value)
}

function toGalleryID(value: number): GalleryID {
  return asGalleryID(value)
}

function toPhotoID(value: number): PhotoID {
  return asPhotoID(value)
}

function findSubmissionPhoto(gallery: Gallery, member_id: number) {
  return gallery.photos.find((photo) => Number(photo.member_id) === member_id)
}

function ensurePhotoAuthor(photo: Photo, member_id: number): void {
  if (Number(photo.member_id) !== member_id) {
    throw forbidden('不能操作其他成员的投稿')
  }
}

export const queries = {
  listGalleries: defineQuery({
    schema: EmptySchema,
    admin: false,
    run: (ctx): PublicHomeDTO => publicHomeDto({
      pool: ctx.pool,
      env: ctx.env,
      now: ctx.now,
    }),
  }),

  getGallery: defineQuery({
    schema: GalleryIDPayloadSchema,
    admin: false,
    run: (ctx, payload): GalleryDTO => {
      const gallery = findGallery(ctx.pool, toGalleryID(payload.gallery_id))
      return galleryDto({
        pool: ctx.pool,
        gallery,
        env: ctx.env,
        now: ctx.now,
        hide_member: galleryInEvent(ctx.now, gallery),
      })
    },
  }),

  getPhoto: defineQuery({
    schema: PhotoIDPayloadSchema,
    admin: false,
    run: (ctx, payload): PhotoDTO => {
      const found = findPhoto(ctx.pool, toPhotoID(payload.photo_id))
      return photoDto({
        pool: ctx.pool,
        gallery: found.gallery,
        photo: found.photo,
        env: ctx.env,
        hide_member: galleryInEvent(ctx.now, found.gallery),
      })
    },
  }),

  getSubmission: defineQuery({
    schema: SubmissionLookupSchema,
    admin: false,
    run: (ctx, payload): PhotoDTO | null => {
      const member = findMemberByQQ(ctx.pool, asQQNumber(payload.qq_num))
      const gallery = findGallery(ctx.pool, toGalleryID(payload.gallery_id))
      const photo = findSubmissionPhoto(gallery, Number(member.id))
      return photo === undefined
        ? null
        : photoDto({ pool: ctx.pool, gallery, photo, env: ctx.env })
    },
  }),

  confirmMember: defineQuery({
    schema: MemberLookupSchema,
    admin: false,
    run: (ctx, payload): { value: boolean } => {
      const member = ctx.pool.members.get(asQQNumber(payload.qq_num))
      return { value: member !== undefined }
    },
  }),

  getMemberPhotos: defineQuery({
    schema: MemberLookupSchema,
    admin: false,
    run: (ctx, payload): PublicHomeDTO => {
      const member = findMemberByQQ(ctx.pool, asQQNumber(payload.qq_num))
      return memberHomeDto({
        pool: ctx.pool,
        env: ctx.env,
        now: ctx.now,
        member,
      })
    },
  }),

  adminGetInstanceConfig: defineQuery({
    schema: EmptySchema,
    admin: true,
    run: (ctx): InstanceConfig => ctx.config,
  }),

  adminStatistic: defineQuery({
    schema: EmptySchema,
    admin: true,
    run: (ctx): StatisticDTO => statisticDto(ctx.pool),
  }),

  adminListGalleries: defineQuery({
    schema: EmptySchema,
    admin: true,
    run: (ctx): GalleryDTO[] => poolGalleriesSorted(ctx.pool).map((gallery) => galleryDto({
      pool: ctx.pool,
      gallery,
      env: ctx.env,
      now: ctx.now,
    })),
  }),

  adminGetGallery: defineQuery({
    schema: GalleryIDPayloadSchema,
    admin: true,
    run: (ctx, payload): GalleryDTO => {
      const gallery = findGallery(ctx.pool, toGalleryID(payload.gallery_id))
      return galleryDto({ pool: ctx.pool, gallery, env: ctx.env, now: ctx.now })
    },
  }),

  adminListMembers: defineQuery({
    schema: EmptySchema,
    admin: true,
    run: (ctx): MemberDTO[] => poolMembersSorted(ctx.pool).map((member) => memberDto(member, ctx.env)),
  }),

  adminGetMember: defineQuery({
    schema: MemberIDPayloadSchema,
    admin: true,
    run: (ctx, payload): MemberDTO => {
      const member = findMemberById(ctx.pool, asMemberID(payload.member_id))
      return memberDto(member, ctx.env)
    },
  }),

  adminListPhotos: defineQuery({
    schema: EmptySchema,
    admin: true,
    run: (ctx): PhotoDTO[] => poolAllPhotos(ctx.pool).map(({ gallery, photo }) => photoDto({
      pool: ctx.pool,
      gallery,
      photo,
      env: ctx.env,
    })),
  }),

  adminGetPhoto: defineQuery({
    schema: PhotoIDPayloadSchema,
    admin: true,
    run: (ctx, payload): PhotoDTO => {
      const found = findPhoto(ctx.pool, toPhotoID(payload.photo_id))
      return photoDto({
        pool: ctx.pool,
        gallery: found.gallery,
        photo: found.photo,
        env: ctx.env,
      })
    },
  }),

  adminListAvailablePhotos: defineQuery({
    schema: EmptySchema,
    admin: true,
    run: (ctx): PhotoDTO[] => poolAllPhotos(ctx.pool).map(({ gallery, photo }) => photoDto({
      pool: ctx.pool,
      gallery,
      photo,
      env: ctx.env,
    })),
  }),

  adminListMemberVotes: defineQuery({
    schema: GalleryIDPayloadSchema,
    admin: true,
    run: (ctx, payload): MemberVoteDTO[] => {
      const gallery = findGallery(ctx.pool, toGalleryID(payload.gallery_id))
      return poolMembersSorted(ctx.pool).map((member) => ({
        ...memberDto(member, ctx.env),
        votes: galleryVotesForMember(gallery, member.id).map((vote) => voteDto(gallery, vote)),
      }))
    },
  }),

  adminListPhotoVotes: defineQuery({
    schema: GalleryIDPayloadSchema,
    admin: true,
    run: (ctx, payload): Array<{ photo: PhotoDTO; votes: VoteDTO[] }> => {
      const gallery = findGallery(ctx.pool, toGalleryID(payload.gallery_id))
      return galleryPhotosSorted(gallery).map((photo) => ({
        photo: photoDto({ pool: ctx.pool, gallery, photo, env: ctx.env }),
        votes: galleryVotesForPhoto(gallery, photo.id).map((vote) => voteDto(gallery, vote)),
      }))
    },
  }),
}

export const mutations = {
  submitPhoto: defineMutation({
    schema: SubmissionCreateSchema,
    admin: false,
    run: async (ctx, payload) => {
      const member = findMemberByQQ(ctx.pool, asQQNumber(payload.qq_num))
      const gallery = findGallery(ctx.pool, toGalleryID(payload.gallery_id))

      if (!galleryCanSubmission(ctx.now, gallery)) {
        throw forbidden('当前不在投稿期间，不能投稿')
      }
      if (memberHasSubmitted(gallery, member.id)) {
        throw conflict('该成员已经在这个相册投过稿了')
      }

      const photo_id = toPhotoID(Number(ctx.pool.next_id))
      const prepared = await ctx.preparePhoto({
        photo_id,
        temp_id: payload.temp_id,
        desc: payload.desc,
        index: 0,
        member_id: member.id,
        gallery_id: gallery.id,
      })

      try {
        const next = poolSubmitPhoto(ctx.pool, ctx.now, gallery.id, member.id, prepared)
        return {
          pool: next.pool,
          result: photoDto({
            pool: next.pool,
            gallery: next.gallery,
            photo: next.photo,
            env: ctx.env,
          }),
        }
      } catch (error) {
        await prepared.discard()
        throw error
      }
    },
  }),

  updateSubmission: defineMutation({
    schema: SubmissionUpdateSchema,
    admin: false,
    run: async (ctx, payload) => {
      const member = findMemberByQQ(ctx.pool, asQQNumber(payload.qq_num))
      const found = findPhoto(ctx.pool, toPhotoID(payload.photo_id))
      ensurePhotoAuthor(found.photo, Number(member.id))
      if (!galleryCanSubmission(ctx.now, found.gallery)) {
        throw forbidden('当前不在投稿期间，不能编辑投稿')
      }

      if (payload.temp_id !== undefined) {
        const prepared = await ctx.preparePhoto({
          photo_id: found.photo.id,
          temp_id: payload.temp_id,
          desc: payload.desc ?? found.photo.desc,
          index: found.photo.index,
          member_id: found.photo.member_id,
          gallery_id: found.gallery.id,
        })
        try {
          const next = poolUpdatePhoto(
            ctx.pool,
            ctx.now,
            found.gallery.id,
            found.photo.id,
            {
              desc: payload.desc,
              src: prepared.src,
              width: prepared.width,
              height: prepared.height,
            },
          )
          return {
            pool: next.pool,
            result: photoDto({
              pool: next.pool,
              gallery: next.gallery,
              photo: next.photo,
              env: ctx.env,
            }),
          }
        } catch (error) {
          await prepared.discard()
          throw error
        }
      }

      const next = poolUpdatePhoto(
        ctx.pool,
        ctx.now,
        found.gallery.id,
        found.photo.id,
        { desc: payload.desc },
      )
      return {
        pool: next.pool,
        result: photoDto({
          pool: next.pool,
          gallery: next.gallery,
          photo: next.photo,
          env: ctx.env,
        }),
      }
    },
  }),

  cancelSubmission: defineMutation({
    schema: SubmissionCancelSchema,
    admin: false,
    run: async (ctx, payload) => {
      const member = findMemberByQQ(ctx.pool, asQQNumber(payload.qq_num))
      const found = findPhoto(ctx.pool, toPhotoID(payload.photo_id))
      ensurePhotoAuthor(found.photo, Number(member.id))
      if (!galleryCanSubmission(ctx.now, found.gallery)) {
        throw forbidden('当前不在投稿期间，不能取消投稿')
      }

      const result = photoDto({
        pool: ctx.pool,
        gallery: found.gallery,
        photo: found.photo,
        env: ctx.env,
      })
      const next = poolRemoveSubmission(
        ctx.pool,
        ctx.now,
        found.gallery.id,
        member.id,
        found.photo.id,
      )
      return { pool: next.pool, result }
    },
  }),

  vote: defineMutation({
    schema: VoteSchema,
    admin: false,
    run: async (ctx, payload) => {
      const member = findMemberByQQ(ctx.pool, asQQNumber(payload.qq_num))
      const next = poolSubmitVotes(
        ctx.pool,
        ctx.now,
        toGalleryID(payload.gallery_id),
        member.id,
        payload.photo_ids.map(toPhotoID),
      )
      return {
        pool: next.pool,
        result: next.votes.map((vote) => voteDto(next.gallery, vote)),
      }
    },
  }),

  adminUpdateInstanceConfig: defineMutation({
    schema: InstanceConfigUpdatePayloadSchema,
    admin: true,
    run: async (ctx, payload) => {
      const next_config = mergeInstanceConfig(ctx.config, payload)
      assertInstanceConfigWithinHardLimit(
        next_config,
        ctx.env.http_body_hard_limit_bytes,
      )
      return {
        pool: ctx.pool,
        result: next_config,
        instance_config: next_config,
      }
    },
  }),

  adminCreateGallery: defineMutation({
    schema: GalleryCreateSchema,
    admin: true,
    run: async (ctx, payload) => {
      const next = poolCreateGallery(ctx.pool, ctx.now, {
        name: payload.name,
        index: payload.index,
        vote_limit: payload.vote_limit,
        event_start: toDate(payload.event_start),
        submission_expire: toDate(payload.submission_expire),
        event_end: toDate(payload.event_end),
      })
      return {
        pool: next.pool,
        result: galleryDto({
          pool: next.pool,
          gallery: next.gallery,
          env: ctx.env,
          now: ctx.now,
        }),
      }
    },
  }),

  adminUpdateGallery: defineMutation({
    schema: GalleryUpdateSchema.extend({ gallery_id: idSchema }).strict(),
    admin: true,
    run: async (ctx, payload) => {
      const { gallery_id, ...rest } = payload
      const next = poolUpdateGallery(ctx.pool, ctx.now, toGalleryID(gallery_id), {
        ...(rest.name === undefined ? {} : { name: rest.name }),
        ...(rest.index === undefined ? {} : { index: rest.index }),
        ...(rest.vote_limit === undefined ? {} : { vote_limit: rest.vote_limit }),
        ...(rest.event_start === undefined ? {} : { event_start: toDate(rest.event_start) }),
        ...(rest.submission_expire === undefined
          ? {}
          : { submission_expire: toDate(rest.submission_expire) }),
        ...(rest.event_end === undefined ? {} : { event_end: toDate(rest.event_end) }),
      })
      return {
        pool: next.pool,
        result: galleryDto({
          pool: next.pool,
          gallery: next.gallery,
          env: ctx.env,
          now: ctx.now,
        }),
      }
    },
  }),

  adminRemoveGallery: defineMutation({
    schema: GalleryIDPayloadSchema,
    admin: true,
    run: async (ctx, payload) => {
      const gallery = findGallery(ctx.pool, toGalleryID(payload.gallery_id))
      const result = galleryDto({
        pool: ctx.pool,
        gallery,
        env: ctx.env,
        now: ctx.now,
      })
      return {
        pool: poolRemoveGallery(ctx.pool, gallery.id).pool,
        result,
      }
    },
  }),

  adminCreateMember: defineMutation({
    schema: MemberCreateSchema,
    admin: true,
    run: async (ctx, payload) => {
      const avatar = await ctx.prepareAvatar({
        qq_num: payload.qq_num,
        temp_id: payload.avatar_temp_id,
      })
      try {
        const next = poolCreateMember(ctx.pool, ctx.now, {
          qq_num: payload.qq_num,
          name: payload.name,
          avatar_src: avatar.avatar_src,
        })
        return {
          pool: next.pool,
          result: memberDto(next.member, ctx.env),
        }
      } catch (error) {
        await avatar.discard()
        throw error
      }
    },
  }),

  adminUpdateMember: defineMutation({
    schema: MemberUpdateSchema.extend({ member_id: idSchema }).strict(),
    admin: true,
    run: async (ctx, payload) => {
      const member = findMemberById(ctx.pool, asMemberID(payload.member_id))
      let avatar_src: string | undefined
      let avatar_discard: (() => Promise<void>) | undefined

      if (payload.avatar_temp_id !== undefined) {
        const avatar = await ctx.prepareAvatar({
          qq_num: member.qq_num,
          temp_id: payload.avatar_temp_id,
        })
        avatar_src = avatar.avatar_src
        avatar_discard = avatar.discard
      }

      try {
        const next = poolUpdateMember(ctx.pool, ctx.now, member.id, {
          ...(payload.name === undefined ? {} : { name: payload.name }),
          ...(avatar_src === undefined ? {} : { avatar_src }),
        })
        return {
          pool: next.pool,
          result: memberDto(next.member, ctx.env),
        }
      } catch (error) {
        if (avatar_discard !== undefined) {
          await avatar_discard()
        }
        throw error
      }
    },
  }),

  adminRemoveMember: defineMutation({
    schema: MemberIDPayloadSchema,
    admin: true,
    run: async (ctx, payload) => {
      const member = findMemberById(ctx.pool, asMemberID(payload.member_id))
      const result = memberDto(member, ctx.env)
      const next = poolDeleteMember(ctx.pool, member.id)
      return { pool: next.pool, result }
    },
  }),

  adminClearMemberGalleryVotes: defineMutation({
    schema: MemberGalleryPayloadSchema,
    admin: true,
    run: async (ctx, payload) => {
      const next = poolClearMemberGalleryVotes(
        ctx.pool,
        ctx.now,
        toGalleryID(payload.gallery_id),
        asMemberID(payload.member_id),
      )
      return {
        pool: next.pool,
        result: next.removed.map((vote) => voteDto(next.gallery, vote)),
      }
    },
  }),

  adminCreatePhoto: defineMutation({
    schema: PhotoCreateSchema,
    admin: true,
    run: async (ctx, payload) => {
      const gallery = findGallery(ctx.pool, toGalleryID(payload.gallery_id))
      findMemberById(ctx.pool, asMemberID(payload.member_id))
      if (memberHasSubmitted(gallery, asMemberID(payload.member_id))) {
        throw conflict('该成员在这个相册已经有投稿了')
      }

      const photo_id = toPhotoID(Number(ctx.pool.next_id))
      const prepared = await ctx.preparePhoto({
        photo_id,
        temp_id: payload.temp_id,
        desc: payload.desc,
        index: payload.index,
        member_id: asMemberID(payload.member_id),
        gallery_id: gallery.id,
      })

      try {
        const next = poolAddPhoto(ctx.pool, ctx.now, gallery.id, prepared)
        return {
          pool: next.pool,
          result: photoDto({
            pool: next.pool,
            gallery: next.gallery,
            photo: next.photo,
            env: ctx.env,
          }),
        }
      } catch (error) {
        await prepared.discard()
        throw error
      }
    },
  }),

  adminUpdatePhoto: defineMutation({
    schema: PhotoUpdateSchema.extend({
      gallery_id: idSchema,
      photo_id: idSchema,
    }).strict(),
    admin: true,
    run: async (ctx, payload) => {
      const found = findPhoto(ctx.pool, toPhotoID(payload.photo_id))
      if (payload.temp_id !== undefined) {
        const prepared = await ctx.preparePhoto({
          photo_id: found.photo.id,
          temp_id: payload.temp_id,
          desc: payload.desc ?? found.photo.desc,
          index: payload.index ?? found.photo.index,
          member_id: payload.member_id === undefined
            ? found.photo.member_id
            : asMemberID(payload.member_id),
          gallery_id: found.gallery.id,
        })
        try {
          const next = poolUpdatePhoto(
            ctx.pool,
            ctx.now,
            found.gallery.id,
            found.photo.id,
            {
              desc: payload.desc,
              index: payload.index,
              member_id: payload.member_id === undefined
                ? undefined
                : asMemberID(payload.member_id),
              src: prepared.src,
              width: prepared.width,
              height: prepared.height,
            },
          )
          return {
            pool: next.pool,
            result: photoDto({
              pool: next.pool,
              gallery: next.gallery,
              photo: next.photo,
              env: ctx.env,
            }),
          }
        } catch (error) {
          await prepared.discard()
          throw error
        }
      }

      const next = poolUpdatePhoto(
        ctx.pool,
        ctx.now,
        found.gallery.id,
        found.photo.id,
        {
          desc: payload.desc,
          index: payload.index,
          member_id: payload.member_id === undefined
            ? undefined
            : asMemberID(payload.member_id),
        },
      )
      return {
        pool: next.pool,
        result: photoDto({
          pool: next.pool,
          gallery: next.gallery,
          photo: next.photo,
          env: ctx.env,
        }),
      }
    },
  }),

  adminRemovePhoto: defineMutation({
    schema: z.object({ photo_id: idSchema }),
    admin: true,
    run: async (ctx, payload) => {
      const found = findPhoto(ctx.pool, toPhotoID(payload.photo_id))
      const result = photoDto({
        pool: ctx.pool,
        gallery: found.gallery,
        photo: found.photo,
        env: ctx.env,
      })
      const next = poolRemovePhoto(
        ctx.pool,
        ctx.now,
        found.gallery.id,
        found.photo.id,
      )
      return { pool: next.pool, result }
    },
  }),

  adminSortPhotosByVoteCount: defineMutation({
    schema: GalleryIDPayloadSchema,
    admin: true,
    run: async (ctx, payload) => {
      const next = poolSortPhotosByVoteCount(
        ctx.pool,
        ctx.now,
        toGalleryID(payload.gallery_id),
      )
      return {
        pool: next.pool,
        result: galleryDto({
          pool: next.pool,
          gallery: next.gallery,
          env: ctx.env,
          now: ctx.now,
        }),
      }
    },
  }),

  adminRefreshThumb: defineMutation({
    schema: PhotoIDPayloadSchema,
    admin: true,
    run: async (ctx, payload) => {
      const found = findPhoto(ctx.pool, toPhotoID(payload.photo_id))
      await ctx.refreshThumb(found.photo.src)
      return {
        pool: ctx.pool,
        result: {
          src: found.photo.src,
          thumb: thumbFilename(found.photo.src),
        },
      }
    },
  }),

  adminRefreshAvatar: defineMutation({
    schema: MemberIDPayloadSchema,
    admin: true,
    run: async (ctx, payload) => {
      const member = findMemberById(ctx.pool, asMemberID(payload.member_id))
      await ctx.refreshAvatar(member.avatar_src)
      return {
        pool: ctx.pool,
        result: {
          avatar_src: member.avatar_src,
          avatar_thumb: thumbFilename(member.avatar_src),
        },
      }
    },
  }),

  adminCleanUnusedImages: defineMutation({
    schema: EmptySchema,
    admin: true,
    run: async (ctx) => {
      const removed = await ctx.cleanUnusedImages(ctx.pool)
      return {
        pool: ctx.pool,
        result: { removed },
      }
    },
  }),
}

for (const key of Object.keys(queries)) {
  if (Object.prototype.hasOwnProperty.call(mutations, key)) {
    throw new Error(`query/mutation 名称冲突: ${key}`)
  }
}

const admin_names = [
  ...Object.entries(queries)
    .filter(([, definition]) => definition.admin)
    .map(([name]) => name),
  ...Object.entries(mutations)
    .filter(([, definition]) => definition.admin)
    .map(([name]) => name),
]

export const __queries_list = queries
export const __mutations_list = mutations
export const __admin_list = Object.freeze(admin_names)

export type QueryName = keyof typeof queries
export type MutationName = keyof typeof mutations
export type MutationResult<K extends MutationName> = Awaited<
  ReturnType<(typeof mutations)[K]['run']>
>['result']

// Keep these imports referenced for external type users.
export type {
  GalleryDTO,
  MemberDTO,
  PhotoDTO,
  PublicHomeDTO,
  StatisticDTO,
  VoteDTO,
}

export function emptyPool(): Pool {
  return poolCreateEmpty()
}

// Validate that ids in action payloads point at existing entities early enough
// for mutations that would otherwise allocate files first.
export function assertGalleryExists(pool: Pool, gallery_id: number): Gallery {
  return findGallery(pool, toGalleryID(gallery_id))
}

export function assertMemberExists(pool: Pool, member_id: number) {
  return findMemberById(pool, asMemberID(member_id))
}

export function assertPhotoExists(pool: Pool, photo_id: number) {
  return findPhoto(pool, toPhotoID(photo_id))
}

export function assertSubmissionExists(
  pool: Pool,
  member_id: number,
  gallery_id: number,
): Photo {
  const gallery = findGallery(pool, toGalleryID(gallery_id))
  const photo = findSubmissionPhoto(gallery, member_id)
  if (photo === undefined) {
    throw notFound('该成员在这个相册没有投稿')
  }
  return photo
}

export function assertCanSubmit(gallery: Gallery, now: Date): void {
  if (!galleryCanSubmission(now, gallery)) {
    throw forbidden('当前不在投稿期间')
  }
}

export function assertBadRequest(message: string): never {
  throw badRequest(message)
}
