// Placeholder Database types. Regenerate with: npm run db:types
// This is a hand-written stub of the schema in supabase/migrations/.
// Replace with `supabase gen types typescript --local` output once the project is provisioned.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type TrainingGoal = 'hypertrophy' | 'strength' | 'recomp' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentAccess = 'full_gym' | 'home_gym' | 'minimal';
export type SexKind = 'male' | 'female' | 'other';
export type WeightUnit = 'kg' | 'lb';
export type PrType = 'max_weight_at_reps' | 'est_one_rm' | 'max_set_volume';
export type PostKind = 'workout' | 'pr' | 'photo' | 'text';
export type AiRole = 'user' | 'assistant' | 'system';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
export type SubPlan = 'free' | 'premium_monthly' | 'premium_yearly';

type Row<T> = {
  Row: T;
  Insert: Partial<T> & { user_id?: string };
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Row<{
        user_id: string;
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
        locale: 'en' | 'fr' | 'ar';
        weight_unit: WeightUnit;
        dob: string | null;
        sex: SexKind | null;
        height_cm: number | null;
        weight_kg: number | null;
        goal: TrainingGoal | null;
        experience_level: ExperienceLevel | null;
        training_days_per_week: number | null;
        equipment_access: EquipmentAccess | null;
        activity_level: string | null;
        diet_preference: string | null;
        goal_pace: string | null;
        target_weight_kg: number | null;
        bio: string | null;
        is_public: boolean;
        injuries: string[] | null;
        created_at: string;
        updated_at: string;
      }>;
      foods: Row<{
        id: string;
        name: string;
        brand: string | null;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        serving_size_g: number;
        source: string | null;
        barcode: string | null;
        name_fr: string | null;
        name_ar: string | null;
        category: string | null;
        aliases: string[] | null;
        slug: string | null;
      }>;
      meals: Row<{
        id: string;
        user_id: string;
        name: string | null;
        meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
        eaten_at: string;
        photo_url: string | null;
        verdict: 'good' | 'ok' | 'bad' | null;
        health_score: number | null;
        ai_summary: string | null;
      }>;
      meal_items: Row<{
        id: string;
        meal_id: string;
        food_id: string | null;
        custom_name: string | null;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        quantity_g: number;
      }>;
      pantry_items: Row<{
        id: string;
        user_id: string;
        food_db_id: string | null;
        name: string;
        quantity: number | null;
        unit: string | null;
        source: 'scan' | 'manual';
        confidence: number | null;
        added_at: string;
        expires_at: string | null;
      }>;
      exercises: Row<{
        id: string;
        name_en: string;
        name_fr: string;
        name_ar: string;
        muscle_group: string;
        secondary_muscles: string[];
        equipment: string;
        instructions_en: string | null;
        instructions_fr: string | null;
        instructions_ar: string | null;
        video_url: string | null;
        is_custom: boolean;
        created_by: string | null;
        created_at: string;
      }>;
      programs: Row<{
        id: string;
        user_id: string;
        name: string;
        goal: string | null;
        weeks: number;
        days_per_week: number;
        is_template: boolean;
        is_ai_generated: boolean;
        source: string | null;
        ai_reasoning: string | null;
        generation_input: unknown;
        created_at: string;
      }>;
      program_days: Row<{
        id: string;
        program_id: string;
        week: number;
        day_index: number;
        name: string | null;
      }>;
      program_exercises: Row<{
        id: string;
        program_day_id: string;
        exercise_id: string;
        order_index: number;
        target_sets: number | null;
        target_reps: number | null;
        target_rpe: number | null;
        rest_seconds: number | null;
        notes: string | null;
      }>;
      workouts: Row<{
        id: string;
        user_id: string;
        program_day_id: string | null;
        name: string | null;
        started_at: string;
        ended_at: string | null;
        total_volume_kg: number;
        notes: string | null;
        created_at: string;
      }>;
      workout_exercises: Row<{
        id: string;
        workout_id: string;
        exercise_id: string;
        order_index: number;
      }>;
      workout_sets: Row<{
        id: string;
        workout_exercise_id: string;
        set_index: number;
        reps: number;
        weight_kg: number;
        rpe: number | null;
        is_warmup: boolean;
        is_drop_set: boolean;
        completed_at: string;
      }>;
      personal_records: Row<{
        id: string;
        user_id: string;
        exercise_id: string;
        record_type: PrType;
        value: number;
        unit: string;
        reps: number | null;
        achieved_at: string;
        workout_set_id: string | null;
      }>;
      subscriptions: Row<{
        id: string;
        user_id: string;
        plan: SubPlan;
        status: SubscriptionStatus;
        started_at: string;
        expires_at: string | null;
        provider_customer_id: string | null;
        updated_at: string;
      }>;
      usage_counters: Row<{
        id: string;
        user_id: string;
        feature: string;
        period_start: string;
        count: number;
      }>;
      entitlement_rules: Row<{
        feature: string;
        free_daily_limit: number | null;
        free_total_limit: number | null;
        premium_only: boolean;
        description: string | null;
      }>;
      posts: Row<{
        id: string;
        user_id: string;
        type: PostKind;
        workout_id: string | null;
        content: string | null;
        image_url: string | null;
        created_at: string;
        updated_at: string;
      }>;
      post_likes: Row<{
        post_id: string;
        user_id: string;
        created_at: string;
      }>;
      post_comments: Row<{
        id: string;
        post_id: string;
        user_id: string;
        content: string;
        created_at: string;
      }>;
      post_saves: Row<{
        post_id: string;
        user_id: string;
        created_at: string;
      }>;
      follows: Row<{
        follower_id: string;
        followed_id: string;
        created_at: string;
      }>;
      wearable_metrics: Row<{
        id: string;
        user_id: string;
        source: 'apple_health' | 'google_fit' | 'health_connect' | 'manual' | 'mock';
        metric_type: string;
        value: number;
        unit: string;
        recorded_at: string;
        recorded_at_local: string | null;
        source_uuid: string | null;
        device_name: string | null;
        synced_at: string | null;
        metadata: Json | null;
      }>;
      sleep_sessions_synced: Row<{
        id: string;
        user_id: string;
        source: 'apple_health' | 'health_connect' | 'mock';
        source_uuid: string | null;
        started_at: string;
        ended_at: string;
        duration_minutes: number;
        in_bed_minutes: number | null;
        asleep_minutes: number | null;
        awake_minutes: number | null;
        rem_minutes: number | null;
        deep_minutes: number | null;
        light_minutes: number | null;
        device_name: string | null;
        metadata: Json | null;
        synced_at: string;
      }>;
      workouts_synced: Row<{
        id: string;
        user_id: string;
        source: 'apple_health' | 'health_connect' | 'mock';
        source_uuid: string | null;
        workout_type: string;
        started_at: string;
        ended_at: string;
        duration_minutes: number;
        total_calories: number | null;
        active_calories: number | null;
        distance_meters: number | null;
        avg_heart_rate: number | null;
        max_heart_rate: number | null;
        device_name: string | null;
        metadata: Json | null;
        linked_workout_id: string | null;
        is_imported_to_app: boolean;
        synced_at: string;
      }>;
      ai_generated_workouts: Row<{
        id: string;
        user_id: string;
        was_saved_as_template: boolean;
        created_at: string;
      }>;
      user_saved_equipment: Row<{
        id: string;
        user_id: string;
        equipment_name: string;
        equipment_data: unknown;
        scanned_image_url: string | null;
        saved_at: string;
      }>;
      health_sync_settings: Row<{
        user_id: string;
        enabled_types: string[];
        ai_biometrics_optin: boolean;
        last_synced_at: string | null;
        permission_revoked: boolean;
        created_at: string;
        updated_at: string;
      }>;
      user_strength_estimates: Row<{
        user_id: string;
        lift_id: string;
        exercise_id: string | null;
        est_one_rm_kg: number;
        best_weight_kg: number;
        best_reps: number;
        level: 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite' | null;
        bodyweight_ratio: number | null;
        bodyweight_kg: number | null;
        computed_at: string;
      }>;
      user_badges: Row<{
        user_id: string;
        badge_id: string;
        earned_at: string;
        meta: Json | null;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
