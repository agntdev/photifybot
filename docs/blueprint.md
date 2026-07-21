# AI Image Generator Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that generates images from text prompts with options for single images or variant galleries, size selection (default 1024×1:024), and in-chat controls to regenerate, upscale, or restart prompts. Uses a freemium model with 10 free generations and paid packs via external links. Tracks job history for 30 days to enable regeneration and upscaling. Admins receive error and usage alerts via Telegram.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- creators
- social-media users
- designers
- hobbyists

## Success criteria

- Users generate images with text prompts
- Regenerate/upscale controls work reliably
- Freemium quota system tracks 10 free generations
- Admin receives error alerts

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with usage explanation
- **Submit prompt** (button, actor: user, callback: prompt:submit) — Initiate new image generation request
  - inputs: text prompt
  - outputs: confirmation card with options
- **Single image** (button, actor: user, callback: option:single) — Request single image generation
  - inputs: confirmed prompt
  - outputs: progress message + image
- **Variants (4)** (button, actor: user, callback: option:variants) — Request 4 variant images
  - inputs: confirmed prompt
  - outputs: progress message + gallery
- **Regenerate** (button, actor: user, callback: action:regenerate) — Repeat last generation with same prompt
  - inputs: previous job data
  - outputs: new image(s)
- **Upscale** (button, actor: user, callback: action:upscale) — Generate upscaled version of selected image
  - inputs: image asset ID
  - outputs: upscaled image

## Flows

### Image generation
_Trigger:_ /start or text prompt

1. Display welcome/usage
2. Collect prompt and settings
3. Show confirmation card
4. Generate images
5. Deliver results with controls

_Data touched:_ Prompt, Job, Image asset

### Error handling
_Trigger:_ Generation failure

1. Show error message
2. Offer retry button

_Data touched:_ Job

### Quota management
_Trigger:_ Generation request after 10 free uses

1. Show payment link
2. Credit user after purchase

_Data touched:_ User

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Telegram account with optional profile data
  - fields: Telegram ID, display name, generation quota
- **Prompt** _(retention: persistent)_ — User-submitted text with generation settings
  - fields: raw text, variant count, size, style tags
- **Job** _(retention: persistent)_ — Generation request status and outputs
  - fields: status, prompt reference, image asset IDs
- **Image asset** _(retention: persistent)_ — Generated image metadata and file reference
  - fields: file ID, size, seed, variant ID

## Integrations

- **Telegram** (required) — Bot API messaging and image delivery
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Admin receives error alerts via Telegram ID
- Payment link management for freemium model

## Notifications

- Error alerts to admin Telegram ID
- Quota usage alerts to admin

## Permissions & privacy

- Store user prompts/jobs for 30 days
- Require user consent for data retention
- No third-party data sharing

## Edge cases

- Generation API failures
- Users exceeding free quota
- Invalid prompt formats

## Required tests

- End-to-end image generation flow with variants
- Regenerate/upscale controls after job completion
- Quota decrement on successful generation

## Assumptions

- External payment processor handles transactions
- Style tags are optional in prompts
- 30-day retention covers 95% of user interaction
