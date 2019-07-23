DROP TABLE IF EXISTS "users";
DROP SEQUENCE IF EXISTS users_id_seq;
CREATE SEQUENCE users_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;

CREATE TABLE "public"."users" (
    "id" bigint DEFAULT nextval('users_id_seq') NOT NULL,
    "createdAt" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
    "updatedAt" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
    "email" text NOT NULL,
    "password" text NOT NULL,
    CONSTRAINT "users_id" PRIMARY KEY ("id"),
    CONSTRAINT "users_email" UNIQUE ("email")
) WITH (oids = false);


DROP TABLE IF EXISTS "auth_keys";
DROP SEQUENCE IF EXISTS auth_keys_id_seq;
CREATE SEQUENCE auth_keys_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;

CREATE TABLE "public"."auth_keys" (
    "id" integer DEFAULT nextval('auth_keys_id_seq') NOT NULL,
    "createdAt" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
    "title" text DEFAULT '' NOT NULL,
    "key" text NOT NULL,
    "user" bigint NOT NULL,
    "origins" json DEFAULT '["*"]' NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "auth_keys_key" UNIQUE ("key"),
    CONSTRAINT "auth_keys_user_fkey" FOREIGN KEY ("user") REFERENCES users(id) NOT DEFERRABLE
) WITH (oids = false);

CREATE INDEX "auth_keys_user" ON "public"."auth_keys" USING btree ("user");


DROP TABLE IF EXISTS "history";
DROP SEQUENCE IF EXISTS history_id_seq;
CREATE SEQUENCE history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;

CREATE TABLE "public"."history" (
    "id" integer DEFAULT nextval('history_id_seq') NOT NULL,
    "createdAt" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
    "key" text NOT NULL,
    "status" integer NOT NULL,
    "user" bigint NOT NULL,
    "from" json DEFAULT '"\"\""' NOT NULL,
    CONSTRAINT "history_id" PRIMARY KEY ("id"),
    CONSTRAINT "history_user_fkey" FOREIGN KEY ("user") REFERENCES users(id) NOT DEFERRABLE
) WITH (oids = false);

CREATE INDEX "history_key" ON "public"."history" USING btree ("key");
