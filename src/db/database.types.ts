
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "agent_cooldowns": {
                  Row: {
                    "fired_at": string,"key": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fired_at"?: string,"key": string,"workspace_id": string
                  }
                  Update: {
                    "fired_at"?: string,"key"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_cooldowns_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"autonomy_policies": {
                  Row: {
                    "act_min_clarity": number,"ask_max_clarity": number,"blocked_hours_threshold": number,"capacity_breach_threshold": number,"esc_nudge_hours": number,"escalate_if_critical_unassigned_hours": number,"never_auto_assign_types": (Database["public"]['Enums']["task_type"])[],"updated_at": string,"updated_by": string | null,"velocity_deficit_pts": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "act_min_clarity"?: number,"ask_max_clarity"?: number,"blocked_hours_threshold"?: number,"capacity_breach_threshold"?: number,"esc_nudge_hours"?: number,"escalate_if_critical_unassigned_hours"?: number,"never_auto_assign_types"?: (Database["public"]['Enums']["task_type"])[],"updated_at"?: string,"updated_by"?: string | null,"velocity_deficit_pts"?: number,"workspace_id": string
                  }
                  Update: {
                    "act_min_clarity"?: number,"ask_max_clarity"?: number,"blocked_hours_threshold"?: number,"capacity_breach_threshold"?: number,"esc_nudge_hours"?: number,"escalate_if_critical_unassigned_hours"?: number,"never_auto_assign_types"?: (Database["public"]['Enums']["task_type"])[],"updated_at"?: string,"updated_by"?: string | null,"velocity_deficit_pts"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "autonomy_policies_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"calibration": {
                  Row: {
                    "correct": number,"decision": Database["public"]['Enums']["agent_decision"],"total": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correct"?: number,"decision": Database["public"]['Enums']["agent_decision"],"total"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "correct"?: number,"decision"?: Database["public"]['Enums']["agent_decision"],"total"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calibration_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"decisions": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"decision": Database["public"]['Enums']["agent_decision"] | null,"id": string,"kind": Database["public"]['Enums']["decision_kind"],"payload": NonNullable<Json>,"rationale": string,"source": Database["public"]['Enums']["decision_source"],"task_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"decision"?: Database["public"]['Enums']["agent_decision"] | null,"id"?: string,"kind": Database["public"]['Enums']["decision_kind"],"payload"?: NonNullable<Json>,"rationale": string,"source": Database["public"]['Enums']["decision_source"],"task_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"decision"?: Database["public"]['Enums']["agent_decision"] | null,"id"?: string,"kind"?: Database["public"]['Enums']["decision_kind"],"payload"?: NonNullable<Json>,"rationale"?: string,"source"?: Database["public"]['Enums']["decision_source"],"task_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "decisions_task_id_tasks_id_fk"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisions_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"escalations": {
                  Row: {
                    "category": Database["public"]['Enums']["escalation_category"],"created_at": string,"id": string,"reason": string,"recommendation": string,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"task_id": string | null,"task_title": string,"urgency": Database["public"]['Enums']["urgency"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["escalation_category"],"created_at"?: string,"id"?: string,"reason": string,"recommendation": string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"task_id"?: string | null,"task_title": string,"urgency": Database["public"]['Enums']["urgency"],"workspace_id": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["escalation_category"],"created_at"?: string,"id"?: string,"reason"?: string,"recommendation"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"task_id"?: string | null,"task_title"?: string,"urgency"?: Database["public"]['Enums']["urgency"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "escalations_task_id_tasks_id_fk"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "escalations_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"feed_events": {
                  Row: {
                    "created_at": string,"decision": Database["public"]['Enums']["agent_decision"] | null,"id": string,"member_id": string | null,"message": string,"task_id": string | null,"type": Database["public"]['Enums']["feed_type"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decision"?: Database["public"]['Enums']["agent_decision"] | null,"id"?: string,"member_id"?: string | null,"message": string,"task_id"?: string | null,"type": Database["public"]['Enums']["feed_type"],"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"decision"?: Database["public"]['Enums']["agent_decision"] | null,"id"?: string,"member_id"?: string | null,"message"?: string,"task_id"?: string | null,"type"?: Database["public"]['Enums']["feed_type"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feed_events_member_id_team_members_id_fk"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feed_events_task_id_tasks_id_fk"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feed_events_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"github_installations": {
                  Row: {
                    "account_login": string,"connected_by": string | null,"created_at": string,"id": string,"installation_id": number,"workspace_id": string,"write_back": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "account_login": string,"connected_by"?: string | null,"created_at"?: string,"id"?: string,"installation_id": number,"workspace_id": string,"write_back"?: boolean
                  }
                  Update: {
                    "account_login"?: string,"connected_by"?: string | null,"created_at"?: string,"id"?: string,"installation_id"?: number,"workspace_id"?: string,"write_back"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "github_installations_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"integrations": {
                  Row: {
                    "created_at": string,"enabled": boolean,"id": string,"kind": Database["public"]['Enums']["integration_kind"],"updated_at": string,"url": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"enabled"?: boolean,"id"?: string,"kind": Database["public"]['Enums']["integration_kind"],"updated_at"?: string,"url": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"enabled"?: boolean,"id"?: string,"kind"?: Database["public"]['Enums']["integration_kind"],"updated_at"?: string,"url"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integrations_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"event": string,"id": string,"integration_id": string,"last_error": string | null,"next_attempt_at": string,"payload": NonNullable<Json>,"sent_at": string | null,"status": Database["public"]['Enums']["outbox_status"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"event": string,"id"?: string,"integration_id": string,"last_error"?: string | null,"next_attempt_at"?: string,"payload": NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["outbox_status"],"workspace_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"event"?: string,"id"?: string,"integration_id"?: string,"last_error"?: string | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["outbox_status"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outbox_integration_id_integrations_id_fk"
      columns: ["integration_id"]
isOneToOne: false
      referencedRelation: "integrations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outbox_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"slack_installations": {
                  Row: {
                    "bot_token_sealed": string,"bot_user_id": string,"channel_id": string | null,"channel_name": string | null,"connected_by": string | null,"created_at": string,"dm_briefings": boolean,"id": string,"team_id": string,"team_name": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bot_token_sealed": string,"bot_user_id": string,"channel_id"?: string | null,"channel_name"?: string | null,"connected_by"?: string | null,"created_at"?: string,"dm_briefings"?: boolean,"id"?: string,"team_id": string,"team_name": string,"workspace_id": string
                  }
                  Update: {
                    "bot_token_sealed"?: string,"bot_user_id"?: string,"channel_id"?: string | null,"channel_name"?: string | null,"connected_by"?: string | null,"created_at"?: string,"dm_briefings"?: boolean,"id"?: string,"team_id"?: string,"team_name"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "slack_installations_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"sprints": {
                  Row: {
                    "committed_points": number,"completed_points": number,"created_at": string,"end_date": string,"goal": string,"health": Database["public"]['Enums']["sprint_health"],"id": string,"name": string,"snapshot": Json | null,"start_date": string,"status": Database["public"]['Enums']["sprint_status"],"total_points": number,"velocity": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "committed_points"?: number,"completed_points"?: number,"created_at"?: string,"end_date": string,"goal"?: string,"health"?: Database["public"]['Enums']["sprint_health"],"id"?: string,"name": string,"snapshot"?: Json | null,"start_date": string,"status"?: Database["public"]['Enums']["sprint_status"],"total_points"?: number,"velocity"?: number,"workspace_id": string
                  }
                  Update: {
                    "committed_points"?: number,"completed_points"?: number,"created_at"?: string,"end_date"?: string,"goal"?: string,"health"?: Database["public"]['Enums']["sprint_health"],"id"?: string,"name"?: string,"snapshot"?: Json | null,"start_date"?: string,"status"?: Database["public"]['Enums']["sprint_status"],"total_points"?: number,"velocity"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sprints_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"task_comments": {
                  Row: {
                    "author_id": string | null,"author_name": string,"body": string,"created_at": string,"id": string,"task_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"author_name": string,"body": string,"created_at"?: string,"id"?: string,"task_id": string,"workspace_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"author_name"?: string,"body"?: string,"created_at"?: string,"id"?: string,"task_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_comments_task_id_tasks_id_fk"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_comments_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"task_dependencies": {
                  Row: {
                    "depends_on_task_id": string,"task_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "depends_on_task_id": string,"task_id": string,"workspace_id": string
                  }
                  Update: {
                    "depends_on_task_id"?: string,"task_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_dependencies_depends_on_task_id_tasks_id_fk"
      columns: ["depends_on_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_task_id_tasks_id_fk"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "acceptance_criteria": (string)[] | null,"ad_hoc_resolution": Database["public"]['Enums']["ad_hoc_resolution"] | null,"ad_hoc_swapped_task_id": string | null,"assignee_id": string | null,"clarity": number,"completed_at": string | null,"confidence": number | null,"created_at": string,"created_by": string | null,"decision": Database["public"]['Enums']["agent_decision"] | null,"decision_reason": string | null,"description": string,"effort": number,"external_blockers": (string)[],"external_ref": string | null,"goal_alignment": number | null,"id": string,"impact": number,"is_ad_hoc": boolean,"is_ai_triaged": boolean,"risk": number,"source": string,"sprint_id": string | null,"status": Database["public"]['Enums']["task_status"],"story_points": number | null,"tags": (string)[],"title": string,"triage_score": number | null,"type": Database["public"]['Enums']["task_type"],"updated_at": string,"urgency": Database["public"]['Enums']["urgency"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acceptance_criteria"?: (string)[] | null,"ad_hoc_resolution"?: Database["public"]['Enums']["ad_hoc_resolution"] | null,"ad_hoc_swapped_task_id"?: string | null,"assignee_id"?: string | null,"clarity": number,"completed_at"?: string | null,"confidence"?: number | null,"created_at"?: string,"created_by"?: string | null,"decision"?: Database["public"]['Enums']["agent_decision"] | null,"decision_reason"?: string | null,"description"?: string,"effort": number,"external_blockers"?: (string)[],"external_ref"?: string | null,"goal_alignment"?: number | null,"id"?: string,"impact": number,"is_ad_hoc"?: boolean,"is_ai_triaged"?: boolean,"risk": number,"source"?: string,"sprint_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"story_points"?: number | null,"tags"?: (string)[],"title": string,"triage_score"?: number | null,"type": Database["public"]['Enums']["task_type"],"updated_at"?: string,"urgency"?: Database["public"]['Enums']["urgency"],"workspace_id": string
                  }
                  Update: {
                    "acceptance_criteria"?: (string)[] | null,"ad_hoc_resolution"?: Database["public"]['Enums']["ad_hoc_resolution"] | null,"ad_hoc_swapped_task_id"?: string | null,"assignee_id"?: string | null,"clarity"?: number,"completed_at"?: string | null,"confidence"?: number | null,"created_at"?: string,"created_by"?: string | null,"decision"?: Database["public"]['Enums']["agent_decision"] | null,"decision_reason"?: string | null,"description"?: string,"effort"?: number,"external_blockers"?: (string)[],"external_ref"?: string | null,"goal_alignment"?: number | null,"id"?: string,"impact"?: number,"is_ad_hoc"?: boolean,"is_ai_triaged"?: boolean,"risk"?: number,"source"?: string,"sprint_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"story_points"?: number | null,"tags"?: (string)[],"title"?: string,"triage_score"?: number | null,"type"?: Database["public"]['Enums']["task_type"],"updated_at"?: string,"urgency"?: Database["public"]['Enums']["urgency"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_team_members_id_fk"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_sprint_id_sprints_id_fk"
      columns: ["sprint_id"]
isOneToOne: false
      referencedRelation: "sprints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "capacity": number,"color": string,"created_at": string,"current_load": number,"id": string,"initials": string,"name": string,"skills": (string)[],"title": string,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number,"color": string,"created_at"?: string,"current_load"?: number,"id"?: string,"initials": string,"name": string,"skills"?: (string)[],"title": string,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "capacity"?: number,"color"?: string,"created_at"?: string,"current_load"?: number,"id"?: string,"initials"?: string,"name"?: string,"skills"?: (string)[],"title"?: string,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"tracker_connections": {
                  Row: {
                    "access_token_sealed": string,"connected_by": string | null,"created_at": string,"expires_at": string | null,"external_id": string,"id": string,"kind": Database["public"]['Enums']["tracker_kind"],"meta": NonNullable<Json>,"name": string,"refresh_token_sealed": string | null,"site_url": string,"workspace_id": string,"write_back": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token_sealed": string,"connected_by"?: string | null,"created_at"?: string,"expires_at"?: string | null,"external_id": string,"id"?: string,"kind": Database["public"]['Enums']["tracker_kind"],"meta"?: NonNullable<Json>,"name": string,"refresh_token_sealed"?: string | null,"site_url": string,"workspace_id": string,"write_back"?: boolean
                  }
                  Update: {
                    "access_token_sealed"?: string,"connected_by"?: string | null,"created_at"?: string,"expires_at"?: string | null,"external_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["tracker_kind"],"meta"?: NonNullable<Json>,"name"?: string,"refresh_token_sealed"?: string | null,"site_url"?: string,"workspace_id"?: string,"write_back"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "tracker_connections_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_workspaces_id_fk"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"slug": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"slug": string,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_agent_cooldown":
{ Args: { "check_key": string,"cooldown_seconds": number,"ws": string }; Returns: boolean
                           },
"create_workspace":
{ Args: { "p_name": string,"p_slug": string }; Returns: string
                           },
"member_by_email":
{ Args: { "member_email": string,"ws": string }; Returns: {
              "role": Database["public"]['Enums']["workspace_role"],"user_id": string
            }[]
                           },
"member_emails":
{ Args: { "ws": string }; Returns: {
              "email": string,"user_id": string
            }[]
                           },
"start_new_sprint":
{ Args: { "p_committed": number,"p_end": string,"p_goal": string,"p_name": string,"p_snapshot"?: Json,"p_start": string,"p_velocity": number,"p_workspace": string }; Returns: string
                           }
          }
          Enums: {
            "ad_hoc_resolution": "absorb"|"swap"|"escalate","agent_decision": "ACT"|"ASK"|"ESCALATE","decision_kind": "triage"|"assign"|"rebalance"|"escalate"|"ad-hoc"|"override","decision_source": "ai"|"rules"|"human","escalation_category": "missing-criteria"|"scope-conflict"|"blocker"|"capacity"|"ambiguous"|"stakeholder","feed_type": "assign"|"escalate"|"triage"|"status"|"risk"|"adHoc"|"resolve"|"intake","integration_kind": "slack_webhook"|"outbound_webhook","outbox_status": "pending"|"sent"|"dead","sprint_health": "green"|"yellow"|"red","sprint_status": "planned"|"active"|"archived","task_status": "backlog"|"triaged"|"assigned"|"in-progress"|"blocked"|"done","task_type": "bug"|"feature"|"spike"|"design"|"urgent"|"ad-hoc"|"chore","tracker_kind": "linear"|"jira","urgency": "critical"|"high"|"medium"|"low","workspace_role": "viewer"|"contributor"|"pm"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "ad_hoc_resolution": ["absorb", "swap", "escalate"],"agent_decision": ["ACT", "ASK", "ESCALATE"],"decision_kind": ["triage", "assign", "rebalance", "escalate", "ad-hoc", "override"],"decision_source": ["ai", "rules", "human"],"escalation_category": ["missing-criteria", "scope-conflict", "blocker", "capacity", "ambiguous", "stakeholder"],"feed_type": ["assign", "escalate", "triage", "status", "risk", "adHoc", "resolve", "intake"],"integration_kind": ["slack_webhook", "outbound_webhook"],"outbox_status": ["pending", "sent", "dead"],"sprint_health": ["green", "yellow", "red"],"sprint_status": ["planned", "active", "archived"],"task_status": ["backlog", "triaged", "assigned", "in-progress", "blocked", "done"],"task_type": ["bug", "feature", "spike", "design", "urgent", "ad-hoc", "chore"],"tracker_kind": ["linear", "jira"],"urgency": ["critical", "high", "medium", "low"],"workspace_role": ["viewer", "contributor", "pm", "admin"]
          }
        }
} as const
