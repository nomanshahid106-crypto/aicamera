import { PRESET_PROMPTS, findPreset } from '../src/lib/presets';

describe('preset prompts', () => {
  it('has at least 10 presets', () => {
    expect(PRESET_PROMPTS.length).toBeGreaterThanOrEqual(10);
  });

  it('includes the required core presets', () => {
    const ids = PRESET_PROMPTS.map((p) => p.id);
    for (const required of [
      'bg-beach',
      'bg-office',
      'bg-mountains',
      'remove-bg-person',
      'linkedin',
      'sunglasses',
      'black-shirt',
      'smooth-skin',
      'cinematic',
      'cartoon',
      'restore-old',
    ]) {
      expect(ids).toContain(required);
    }
  });

  it('has unique ids and non-empty label + prompt for every preset', () => {
    const ids = new Set(PRESET_PROMPTS.map((p) => p.id));
    expect(ids.size).toBe(PRESET_PROMPTS.length);
    for (const p of PRESET_PROMPTS) {
      expect(p.label.trim().length).toBeGreaterThan(0);
      expect(p.prompt.trim().length).toBeGreaterThan(10);
    }
  });

  it('findPreset returns the matching preset and undefined otherwise', () => {
    expect(findPreset('sunglasses')?.label).toBe('Add sunglasses');
    expect(findPreset('does-not-exist')).toBeUndefined();
  });
});
