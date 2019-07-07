CREATE SEQUENCE users_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;
CREATE TABLE "public"."users" (
    "id" integer DEFAULT nextval('users_id_seq') NOT NULL,
    "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    "updatedAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    "email" text NOT NULL,
    "password" text NOT NULL,
    CONSTRAINT "users_id" PRIMARY KEY ("id")
) WITH (oids = false);

CREATE TABLE "public"."auth_keys" (
    "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    "user" bigint NOT NULL,
    "key" text NOT NULL,
    CONSTRAINT "auth_keys_key" UNIQUE ("key"),
    CONSTRAINT "auth_keys_user_fkey" FOREIGN KEY ("user") REFERENCES users(id) NOT DEFERRABLE
) WITH (oids = false);

CREATE INDEX "auth_keys_user" ON "public"."auth_keys" USING btree ("user");



-- 2019-07-06 15:12:30.21052-04
