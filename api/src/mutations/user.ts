/**
 * GraphQL API mutations related to user accounts.
 *
 * @copyright 2016-present Kriasoft (https://git.io/vMINh)
 */

import { mutationWithClientMutationId } from "graphql-relay";
import {
  GraphQLNonNull,
  GraphQLID,
  GraphQLString,
  GraphQLBoolean,
} from "graphql";

import db, { User } from "../db";
import { Context } from "../context";
import { UserType } from "../types";
import { fromGlobalId } from "../utils";

export const updateUser = mutationWithClientMutationId({
  name: "UpdateUser",
  description: "Updates a user.",

  inputFields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    username: { type: GraphQLString },
    email: { type: GraphQLString },
    name: { type: GraphQLString },
    picture: { type: GraphQLString },
    timeZone: { type: GraphQLString },
    locale: { type: GraphQLString },
    admin: { type: GraphQLBoolean },
    validateOnly: { type: GraphQLBoolean },
  },

  outputFields: {
    user: { type: UserType },
  },

  async mutateAndGetPayload(input, ctx: Context) {
    const id = fromGlobalId(input.id, "User");

    // Check permissions
    ctx.ensureAuthorized((user) => user.id === id || user.admin);

    const usernameAvailable = await db
      .table("users")
      .where({ username: input.username.trim() })
      .whereNot({ id })
      .select(db.raw("1"))
      .then((x) => !x.length);

    // Validate and sanitize user input
    const data = ctx.validate(input, (x) =>
      x
        .field("username", { trim: true })
        .isLength({ min: 1, max: 50 })
        .is(() => usernameAvailable, "That username is taken. Try another.")

        .field("email")
        .isLength({ max: 100 })
        .isEmail()

        .field("name", { trim: true })
        .isLength({ min: 1, max: 100 })

        .field("picture", { as: "picture" })
        .isLength({ max: 250 })
        .isURL()

        .field("timeZone", { as: "time_zone" })
        .isLength({ max: 50 })

        .field("locale")
        .isLength({ max: 10 })

        .field("admin")
        .is(
          () => Boolean(ctx.user?.admin),
          "Only admins can update this field.",
        )

        .field("archived")
        .is(
          () => Boolean(ctx.user?.admin),
          "Only admins can update this field.",
        ),
    );

    if (input.validateOnly) {
      return { user: null };
    }

    let user;

    if (Object.keys(data).length) {
      [user] = await db
        .table<User>("users")
        .where({ id })
        .update({ ...data, updated_at: db.fn.now() })
        .returning("*");
    }

    return { user };
  },
});
