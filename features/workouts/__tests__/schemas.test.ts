import { exerciseFilterSchema, workoutDraftSchema } from '../schemas';

describe('workout schemas', () => {
  it('applies defaults to exerciseFilter', () => {
    const f = exerciseFilterSchema.parse({});
    expect(f.query).toBe('');
    expect(f.muscleGroup).toBeNull();
    expect(f.equipment).toBeNull();
  });

  it('rejects invalid workout draft (bad uuid)', () => {
    const r = workoutDraftSchema.safeParse({
      id: 'not-a-uuid',
      user_id: '11111111-1111-1111-1111-111111111111',
      started_at: new Date().toISOString(),
    });
    expect(r.success).toBe(false);
  });

  it('accepts a minimal valid draft', () => {
    const r = workoutDraftSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      user_id: '22222222-2222-2222-2222-222222222222',
      started_at: new Date().toISOString(),
    });
    expect(r.success).toBe(true);
  });
});
