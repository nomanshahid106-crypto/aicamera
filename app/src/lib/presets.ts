export interface PresetPrompt {
  id: string;
  label: string;
  prompt: string;
}

/**
 * One-tap edit prompts shown as chips on the Edit screen.
 * Prompts are written to preserve the person's identity/pose unless the
 * edit itself requires changing them — Qwen-Image-Edit follows that well.
 */
export const PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: 'bg-beach',
    label: 'Background: Beach',
    prompt:
      'Change the background to a sunny tropical beach with palm trees. Keep the person, face, pose and clothing exactly the same.',
  },
  {
    id: 'bg-office',
    label: 'Background: Office',
    prompt:
      'Change the background to a modern professional office interior. Keep the person, face, pose and clothing exactly the same.',
  },
  {
    id: 'bg-mountains',
    label: 'Background: Mountains',
    prompt:
      'Change the background to a scenic mountain landscape at golden hour. Keep the person, face, pose and clothing exactly the same.',
  },
  {
    id: 'remove-bg-person',
    label: 'Remove background person',
    prompt:
      'Remove any other people in the background. Keep the main person completely unchanged and fill the background naturally.',
  },
  {
    id: 'linkedin',
    label: 'Professional for LinkedIn',
    prompt:
      'Make this photo look like a professional LinkedIn headshot: clean neutral studio background, soft professional lighting, sharp focus. Keep the same face and identity.',
  },
  {
    id: 'sunglasses',
    label: 'Add sunglasses',
    prompt:
      'Add stylish black sunglasses to the person. Keep everything else in the photo exactly the same.',
  },
  {
    id: 'black-shirt',
    label: 'Change shirt to black',
    prompt:
      'Change the person\'s shirt/top to plain black. Keep the face, pose, background and lighting exactly the same.',
  },
  {
    id: 'smooth-skin',
    label: 'Smooth skin',
    prompt:
      'Smooth the skin and remove blemishes and pimples for a clean natural retouched look. Keep the face, identity and everything else the same.',
  },
  {
    id: 'cinematic',
    label: 'Cinematic look',
    prompt:
      'Give this photo a cinematic look: dramatic lighting, rich contrast, teal and orange color grading, film still quality. Keep the person and scene the same.',
  },
  {
    id: 'cartoon',
    label: 'Cartoon style',
    prompt:
      'Turn this photo into a clean modern cartoon illustration style. Keep the person clearly recognizable with the same pose and scene.',
  },
  {
    id: 'restore-old',
    label: 'Restore old photo',
    prompt:
      'Restore this old photo: remove scratches, dust and damage, fix fading, enhance sharpness and restore natural colors. Keep the people and scene the same.',
  },
  {
    id: 'brighten',
    label: 'Brighten',
    prompt:
      'Brighten this photo and improve the lighting and exposure so the subject is clearly and naturally lit. Keep everything else the same.',
  },
];

export function findPreset(id: string): PresetPrompt | undefined {
  return PRESET_PROMPTS.find((p) => p.id === id);
}
