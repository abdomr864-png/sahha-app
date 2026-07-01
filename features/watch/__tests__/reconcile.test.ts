import { reduceWatchMessage, type ReconcileCtx } from '../reconcile';
import type { WatchInbound } from '../messages';
import type { WorkoutDraft } from '@features/workouts';

const CTX: ReconcileCtx = { userId: 'user-1', now: '2026-06-04T10:00:00.000Z' };

function draftWith(sets: { id: string; completed?: boolean }[] = []): WorkoutDraft {
  return {
    id: 'w1',
    user_id: 'user-1',
    name: 'Push day',
    started_at: '2026-06-04T09:00:00.000Z',
    ended_at: null,
    exercises: [
      {
        id: 'ex1',
        exercise_id: 'exercise-uuid',
        order_index: 0,
        target_sets: 3,
        target_reps: 8,
        target_rpe: null,
        rest_seconds: 90,
        notes: null,
        sets: sets.map((s, i) => ({
          id: s.id,
          set_index: i + 1,
          reps: 8,
          weight_kg: 100,
          rpe: null,
          is_warmup: false,
          is_drop_set: false,
          completed: s.completed ?? false,
        })),
      },
    ],
  };
}

describe('startWorkout', () => {
  it('creates a draft whose id is the message id (deterministic, replay-safe)', () => {
    const msg: WatchInbound = {
      type: 'startWorkout',
      messageId: 'msg-abc',
      name: 'Leg day',
      at: CTX.now,
    };
    const res = reduceWatchMessage(null, msg, CTX);
    expect(res.draft?.id).toBe('msg-abc');
    expect(res.draft?.user_id).toBe('user-1');
    expect(res.ops).toEqual([{ kind: 'workout.upsert', payload: res.draft, id: 'msg-abc' }]);
    expect(res.ack).toEqual({ kind: 'ack', messageId: 'msg-abc', ok: true });
  });

  it('is a no-op when a workout is already active (no second workout)', () => {
    const existing = draftWith();
    const msg: WatchInbound = { type: 'startWorkout', messageId: 'msg-x', name: null, at: CTX.now };
    const res = reduceWatchMessage(existing, msg, CTX);
    expect(res.draft).toBe(existing); // referentially unchanged
    expect(res.ops).toHaveLength(0);
    expect(res.ack.ok).toBe(true);
  });

  it('fails without an authed user', () => {
    const msg: WatchInbound = { type: 'startWorkout', messageId: 'm', name: null, at: CTX.now };
    const res = reduceWatchMessage(null, msg, { userId: null, now: CTX.now });
    expect(res.ack).toEqual({ kind: 'ack', messageId: 'm', ok: false, reason: 'no-user' });
    expect(res.draft).toBeNull();
  });
});

describe('finishWorkout', () => {
  it('ends the workout and emits a finish op', () => {
    const res = reduceWatchMessage(
      draftWith([{ id: 's1', completed: true }]),
      {
        type: 'finishWorkout',
        messageId: 'm',
        at: CTX.now,
      },
      CTX,
    );
    expect(res.draft).toBeNull();
    expect(res.ops[0]!.kind).toBe('workout.finish');
    expect((res.ops[0]!.payload as WorkoutDraft).ended_at).toBe(CTX.now);
  });

  it('fails when there is nothing active', () => {
    const res = reduceWatchMessage(
      null,
      { type: 'finishWorkout', messageId: 'm', at: CTX.now },
      CTX,
    );
    expect(res.ack).toEqual({ kind: 'ack', messageId: 'm', ok: false, reason: 'no-active' });
  });
});

describe('completeSet', () => {
  const msg = (
    over: Partial<Extract<WatchInbound, { type: 'completeSet' }>> = {},
  ): WatchInbound => ({
    type: 'completeSet',
    messageId: 'm1',
    workoutExerciseId: 'ex1',
    setId: 's1',
    reps: 10,
    weightKg: 102.5,
    at: CTX.now,
    ...over,
  });

  it('marks an existing set complete and enqueues an upsert keyed by set id', () => {
    const res = reduceWatchMessage(draftWith([{ id: 's1' }]), msg(), CTX);
    const set = res.draft!.exercises[0]!.sets[0]!;
    expect(set.completed).toBe(true);
    expect(set.reps).toBe(10);
    expect(set.weight_kg).toBe(102.5);
    expect(res.ops).toEqual([
      {
        kind: 'workout_set.upsert',
        payload: { ...set, workout_exercise_id: 'ex1' },
        id: 's1',
      },
    ]);
  });

  it('creates the set when the watch logged one not yet in the snapshot', () => {
    const res = reduceWatchMessage(
      draftWith([{ id: 's1', completed: true }]),
      msg({ setId: 's2' }),
      CTX,
    );
    const sets = res.draft!.exercises[0]!.sets;
    expect(sets).toHaveLength(2);
    expect(sets[1]!.id).toBe('s2');
    expect(sets[1]!.set_index).toBe(2);
    expect(sets[1]!.completed).toBe(true);
  });

  it('is idempotent — replaying the same message yields the same draft and op id', () => {
    const start = draftWith([{ id: 's1' }]);
    const once = reduceWatchMessage(start, msg(), CTX);
    const twice = reduceWatchMessage(once.draft, msg(), CTX);
    expect(twice.draft).toEqual(once.draft);
    expect(twice.ops[0]!.id).toBe('s1');
    expect(once.draft!.exercises[0]!.sets).toHaveLength(1); // no duplicate set
  });

  it('does not duplicate when the phone already completed the same set (single source of truth)', () => {
    // Phone completed s1 in-app; watch replays its own completeSet for s1.
    const phoneCompleted = draftWith([{ id: 's1', completed: true }]);
    const res = reduceWatchMessage(phoneCompleted, msg(), CTX);
    expect(res.draft!.exercises[0]!.sets).toHaveLength(1);
    expect(res.ops[0]!.id).toBe('s1'); // same stable id → queue de-dupes
  });

  it('fails when the target exercise is gone', () => {
    const res = reduceWatchMessage(
      draftWith([{ id: 's1' }]),
      msg({ workoutExerciseId: 'nope' }),
      CTX,
    );
    expect(res.ack).toEqual({ kind: 'ack', messageId: 'm1', ok: false, reason: 'no-exercise' });
  });
});

describe('addSet', () => {
  it('appends an empty set without enqueuing (persists only on completion)', () => {
    const res = reduceWatchMessage(
      draftWith([{ id: 's1', completed: true }]),
      {
        type: 'addSet',
        messageId: 'm',
        workoutExerciseId: 'ex1',
        setId: 's2',
        at: CTX.now,
      },
      CTX,
    );
    expect(res.draft!.exercises[0]!.sets).toHaveLength(2);
    expect(res.ops).toHaveLength(0);
  });

  it('is idempotent when the set already exists', () => {
    const res = reduceWatchMessage(
      draftWith([{ id: 's1' }]),
      {
        type: 'addSet',
        messageId: 'm',
        workoutExerciseId: 'ex1',
        setId: 's1',
        at: CTX.now,
      },
      CTX,
    );
    expect(res.draft!.exercises[0]!.sets).toHaveLength(1);
    expect(res.changed).toBe(false);
  });
});

describe('updateSet', () => {
  it('edits an uncompleted set without enqueuing', () => {
    const res = reduceWatchMessage(
      draftWith([{ id: 's1' }]),
      {
        type: 'updateSet',
        messageId: 'm',
        workoutExerciseId: 'ex1',
        setId: 's1',
        reps: 12,
        weightKg: null,
        at: CTX.now,
      },
      CTX,
    );
    expect(res.draft!.exercises[0]!.sets[0]!.reps).toBe(12);
    expect(res.draft!.exercises[0]!.sets[0]!.weight_kg).toBe(100); // null = keep
    expect(res.ops).toHaveLength(0);
  });

  it('re-emits an upsert when editing an already-completed set', () => {
    const res = reduceWatchMessage(
      draftWith([{ id: 's1', completed: true }]),
      {
        type: 'updateSet',
        messageId: 'm',
        workoutExerciseId: 'ex1',
        setId: 's1',
        reps: 9,
        weightKg: 105,
        at: CTX.now,
      },
      CTX,
    );
    expect(res.ops[0]!.kind).toBe('workout_set.upsert');
    expect(res.ops[0]!.id).toBe('s1');
  });
});

describe('setPaused', () => {
  it('updates ephemeral session state, not the draft or queue', () => {
    const d = draftWith();
    const res = reduceWatchMessage(
      d,
      { type: 'setPaused', messageId: 'm', paused: true, at: CTX.now },
      CTX,
    );
    expect(res.draft).toBe(d);
    expect(res.ops).toHaveLength(0);
    expect(res.sessionPatch).toEqual({ paused: true });
  });
});
