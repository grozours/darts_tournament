import { describe, expect, it } from '@jest/globals';
import { SkillLevel } from '../../../shared/src/types';
import {
  createGroupSchema,
  updateGroupSchema,
} from '../../src/routes/tournaments/schemas';

const GROUP_CODE = ['schema', '-', 'code'].join('');

describe('tournament group schemas', () => {
  it('accepts nullable skill level in create payload', () => {
    const parsed = createGroupSchema.body.parse({
      name: 'Team One',
      password: GROUP_CODE,
      skillLevel: null,
    });

    expect(parsed.skillLevel).toBeNull();
  });

  it('accepts skillLevel-only update payload and rejects empty payload', () => {
    const parsed = updateGroupSchema.body.parse({
      skillLevel: SkillLevel.EXPERT,
    });

    expect(parsed.skillLevel).toBe(SkillLevel.EXPERT);
    expect(() => updateGroupSchema.body.parse({})).toThrow('At least one field is required');
  });
});
