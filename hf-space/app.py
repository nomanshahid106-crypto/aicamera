"""
PromptCam AI Engine — free prompt-based photo editing on Hugging Face ZeroGPU.

Model: Qwen/Qwen-Image-Edit via diffusers (QwenImageEditPipeline).
ZeroGPU pattern: the pipeline is loaded to CPU at module level; each request
runs inside a @spaces.GPU-decorated function that moves it to the GPU.

The Gradio function is exposed with api_name="edit_image" — the PromptCam
mobile app calls POST /gradio_api/call/edit_image (see README.md).
"""

import spaces
import torch
import gradio as gr
from PIL import Image
from diffusers import QwenImageEditPipeline

MODEL_ID = "Qwen/Qwen-Image-Edit"

# Loaded once at startup on CPU (ZeroGPU requirement: no CUDA at import time).
pipe = QwenImageEditPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
pipe.set_progress_bar_config(disable=True)


@spaces.GPU(duration=120)
def edit_image(image: Image.Image, prompt: str, seed: float = 0, steps: float = 28) -> Image.Image:
    """Edit `image` according to the natural-language `prompt`.

    Args:
        image: Input photo (PIL Image).
        prompt: Edit instruction, e.g. "Change the background to a beach".
        seed: Random seed (0 = pick a fixed default seed of 42 unless > 0).
        steps: Number of inference steps (more = slower, usually better).

    Returns:
        The edited PIL Image.
    """
    if image is None:
        raise gr.Error("No image provided.")
    if not prompt or not prompt.strip():
        raise gr.Error("Please enter an edit prompt.")

    image = image.convert("RGB")
    # Cap input size: keeps ZeroGPU time and memory within the free quota.
    image.thumbnail((1024, 1024))

    seed_int = int(seed) if seed and int(seed) > 0 else 42
    steps_int = int(steps) if steps and int(steps) >= 4 else 28
    generator = torch.Generator(device="cuda").manual_seed(seed_int)

    pipe.to("cuda")
    try:
        with torch.inference_mode():
            result = pipe(
                image=image,
                prompt=prompt.strip(),
                negative_prompt=" ",
                true_cfg_scale=4.0,
                num_inference_steps=steps_int,
                generator=generator,
            ).images[0]
    finally:
        pipe.to("cpu")
        torch.cuda.empty_cache()
    return result


demo = gr.Interface(
    fn=edit_image,
    inputs=[
        gr.Image(type="pil", label="Your photo"),
        gr.Textbox(label="Edit prompt", placeholder="Change the background to a beach at sunset"),
        gr.Number(label="Seed (0 = default)", value=0, precision=0),
        gr.Slider(label="Steps", minimum=4, maximum=50, value=28, step=1),
    ],
    outputs=gr.Image(type="pil", label="Edited photo"),
    title="PromptCam AI Engine",
    description=(
        "Free prompt-based photo editing powered by Qwen-Image-Edit on "
        "Hugging Face ZeroGPU. Upload a photo, describe the edit, get the result."
    ),
    api_name="edit_image",
)

if __name__ == "__main__":
    demo.launch()
