CREATE TABLE "flow_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"flow_id" integer NOT NULL,
	"source_node_id" integer NOT NULL,
	"target_node_id" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"flow_id" integer NOT NULL,
	"form_submission_id" integer,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"current_node_id" integer,
	"variables" jsonb DEFAULT '{}'::jsonb,
	"history" jsonb DEFAULT '[]'::jsonb,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"flow_id" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"label" varchar(255),
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_variables" (
	"id" serial PRIMARY KEY NOT NULL,
	"flow_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"default_value" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"start_node_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "flows_form_id_unique" UNIQUE("form_id")
);
--> statement-breakpoint
ALTER TABLE "flow_edges" ADD CONSTRAINT "flow_edges_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_edges" ADD CONSTRAINT "flow_edges_source_node_id_flow_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."flow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_edges" ADD CONSTRAINT "flow_edges_target_node_id_flow_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."flow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_form_submission_id_form_submissions_id_fk" FOREIGN KEY ("form_submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_current_node_id_flow_nodes_id_fk" FOREIGN KEY ("current_node_id") REFERENCES "public"."flow_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_nodes" ADD CONSTRAINT "flow_nodes_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_variables" ADD CONSTRAINT "flow_variables_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_edges_flow_id_idx" ON "flow_edges" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "flow_executions_flow_id_idx" ON "flow_executions" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "flow_nodes_flow_id_idx" ON "flow_nodes" USING btree ("flow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_variables_flow_id_name_idx" ON "flow_variables" USING btree ("flow_id","name");--> statement-breakpoint
CREATE INDEX "flows_form_id_idx" ON "flows" USING btree ("form_id");