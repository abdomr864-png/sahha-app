import { projectWorkout } from '../projection';
import { PROTOCOL_VERSION } from '../messages';
import type { WorkoutDraft } from '@features/workouts';

const NOW = '2026-06-04T10:00:00.000Z';
const opts = (over: Partial<Parameters<typeof projectWorkout>[1]> = {}) => ({
  resolveName: (id: string) => (id === 'bench-uuid' ? 'Bench Press' : undefined),
  paused: false,
  now: NOW,
  ...over,
});

function draft(): WorkoutDraft {
  return {
    id: 'w1',
    user_id: 'u1',
    name: 'Push',
    started_at: '2026-06-04T09:00:00.000Z',
    ended_at: null,
    exercises: [
      {
        id: 'ex1',
        exercise_id: 'bench-uuid',
        order_index: 0,
        target_sets: 3,
        target_reps: 8,
        target_rpe: null,
        rest_seconds: 120,
        notes: null,
        sets: [
          {
            id: 's1',
            set_index: 1,
            reps: 8,
            weight_kg: 100,
            rpe: null,
            is_warmup: false,
            is_drop_set: false,
            completed: true,
          },
          {
            id: 's2',
            set_index: 2,
            reps: 8,
            weight_kg: 100,
            rpe: null,
            is_warmup: false,
            is_drop_set: false,
            completed: false,
          },
        ],
      },
    ],
  };
}

describe('projectWorkout', () => {
  it('returns an inactive snapshot for a null draft', () => {
    const snap = projectWorkout(null, opts());
    expect(snap.active).toBe(false);
    expect(snap.exercises).toEqual([]);
    expect(snap.v).toBe(PROTOCOL_VERSION);
    expect(snap.updatedAt).toBe(NOW);
  });

  it('projects an active workout with resolved names and target reps', () => {
    const snap = projectWorkout(draft(), opts());
    expect(snap.active).toBe(true);
    expect(snap.workoutId).toBe('w1');
    expect(snap.exercises[0]!.name).toBe('Bench Press');
    expect(snap.exercises[0]!.targetReps).toBe(8);
    expect(snap.exercises[0]!.restSeconds).toBe(120);
    expect(snap.exercises[0]!.sets).toHaveLength(2);
  });

  it('falls back to a generic name when the resolver has none', () => {
    const d = draft();
    d.exercises[0]!.exercise_id = 'unknown-uuid';
    expect(projectWorkout(d, opts()).exercises[0]!.name).toBe('Exercise');
  });

  it('points the glance at the first incomplete set', () => {
    const snap = projectWorkout(draft(), opts());
    expect(snap.currentExerciseId).toBe('ex1');
    expect(snap.currentSetId).toBe('s2');
  });

  it('points at the last set when everything is complete', () => {
    const d = draft();
    d.exercises[0]!.sets[1]!.completed = true;
    const snap = projectWorkout(d, opts());
    expect(snap.currentSetId).toBe('s2');
  });

  it('passes the paused flag through', () => {
    expect(projectWorkout(draft(), opts({ paused: true })).paused).toBe(true);
    expect(projectWorkout(null, opts({ paused: true })).paused).toBe(true);
  });
});
