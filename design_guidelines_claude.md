# Design Guidelines for Overlay AI - 2026 Modernization

## Executive Summary

This document provides comprehensive design guidelines for modernizing Overlay AI's interface based on extensive research of similar applications, current design trends, and best practices for 2026. The goal is to evolve the existing glassmorphic design into a more polished, accessible, and user-friendly experience while maintaining the stealth overlay functionality.

**Current State**: Overlay AI is an AI-powered interview assistant with real-time transcription, featuring a dark glassmorphic design with indigo accents.

**Target State**: A refined, modern glassmorphic interface that incorporates 2026 design trends, improved accessibility, enhanced micro-interactions, and better visual hierarchy.

---

## Table of Contents

1. [Design Philosophy & Principles](#1-design-philosophy--principles)
2. [Modern Glassmorphism (2026)](#2-modern-glassmorphism-2026)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Iconography](#6-iconography)
7. [Component Design Patterns](#7-component-design-patterns)
8. [Micro-interactions & Animation](#8-micro-interactions--animation)
9. [Accessibility Standards](#9-accessibility-standards)
10. [AI Interface Patterns](#10-ai-interface-patterns)
11. [Keyboard-First Design](#11-keyboard-first-design)
12. [Real-time Transcription UI](#12-real-time-transcription-ui)
13. [Implementation Recommendations](#13-implementation-recommendations)

---

## 1. Design Philosophy & Principles

### Core Principles

**Clarity Over Complexity**
- Minimize visual noise while maintaining depth through layering
- Use glassmorphism purposefully, not decoratively
- Every element should have a clear purpose

**Keyboard-First, Touch-Aware**
- Design for power users who rely on keyboard shortcuts
- Provide clear visual feedback for all interactions
- Ensure touch targets meet accessibility standards

**Contextual Intelligence**
- Show information when needed, hide when not
- Use smart defaults and predictive patterns
- Respect user attention and cognitive load

**Accessible by Default**
- Meet WCAG 2.1 AA standards minimum
- Design for various vision conditions
- Support screen readers and keyboard navigation

### Inspiration Sources

**Similar Applications Analyzed**:
- **Raycast**: Command palette excellence, keyboard-first design, extension architecture
- **Arc Browser**: Innovative sidebar patterns, contextual UI, beautiful gradients
- **macOS Spotlight**: Minimal, fast, predictable
- **ChatGPT Desktop**: Clean AI chat interface, streaming text handling
- **GitHub Copilot**: Inline suggestions, unobtrusive assistance
- **Notion**: Clean typography, calm color palette, excellent information hierarchy

**Key Takeaway**: Modern overlay applications succeed by being fast, predictable, keyboard-accessible, and visually calming rather than distracting.

---

## 2. Modern Glassmorphism (2026)

### The 2026 Evolution

Glassmorphism is experiencing a comeback in 2026, but in a **smarter, more restrained, and functional form**. The trend is moving toward "Dark Glassmorphism" which works beautifully with dark mode applications.

**Key Characteristics**:
- Stacking layers of semi-transparent surfaces over vibrant, deep gradients
- Glass panels that blur whatever is behind them
- Dynamic backgrounds that feel alive
- Better accessibility through improved contrast
- Performance-optimized implementations

### Dark Glassmorphism Best Practices

**Background Layers**:
```
Layer 1 (Deepest): Deep dark gradient (not pure black #000000)
Layer 2 (Ambient): Vibrant orbs of color (deep purples, neon blues, subtle pinks)
Layer 3 (Glass): Semi-transparent UI elements with backdrop blur
Layer 4 (Content): High-contrast text and interactive elements
```

**Recommended Background Colors**:
- Base: `#0a0a0f` to `#12121a` (soft dark, not pure black)
- Pure black (#000000) causes eye strain and "halation effect"
- Use dark grays for better legibility

**Blur Values**:
- Small components: 8-12px backdrop blur
- Medium cards/panels: 16-24px backdrop blur
- Large containers: 24-40px backdrop blur
- Modal overlays: 40-60px backdrop blur

**Opacity Ranges**:
- Background surfaces: 0.05-0.12 opacity
- Elevated surfaces: 0.12-0.18 opacity
- Active/hover states: 0.15-0.25 opacity
- Accent overlays: 0.4-0.6 opacity

### Gradient Backgrounds (Ambient Layer)

**2026 Trend**: Vibrant gradient orbs that create depth

**Recommended Approach**:
```css
/* Animated ambient gradient */
background: radial-gradient(
  circle at 20% 80%,
  rgba(99, 102, 241, 0.15) 0%,
  transparent 50%
),
radial-gradient(
  circle at 80% 20%,
  rgba(168, 85, 247, 0.12) 0%,
  transparent 50%
),
radial-gradient(
  circle at 40% 40%,
  rgba(59, 130, 246, 0.08) 0%,
  transparent 50%
);
```

**Animation**: Subtle movement of gradient orbs (slow, 20-30s duration)

### Accessibility Considerations

**Critical Warning**: Glassmorphism can ruin contrast ratios if not careful.

**Rules**:
- Text must always be `text-white` or `text-gray-100`
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text
- Test all text on glass surfaces with contrast checkers
- Provide high-contrast mode option

---

## 3. Color System

### Primary Palette

**Current**: Indigo-based (`#6366f1`)
**Recommendation**: Keep indigo but refine the palette for better hierarchy

**Core Colors**:
```
Primary (Accent):
- indigo-500: #6366f1 (main accent)
- indigo-400: #818cf8 (lighter accent)
- indigo-600: #4f46e5 (darker accent)

Secondary (Alternative Accent):
- violet-500: #8b5cf6 (for variety)
- purple-500: #a855f7 (for emphasis)

Gradients:
- Use gradient from indigo-500 to violet-600
- Subtle gradient overlays on interactive elements
```

### Semantic Colors

**Status Indicators**:
```
Success:
- green-500: #10b981 (keep current)
- green-400: #34d399 (lighter variant)

Warning:
- amber-500: #f59e0b (keep current)
- amber-400: #fbbf24 (lighter variant)

Error:
- red-500: #ef4444 (keep current)
- red-400: #f87171 (lighter variant)

Info:
- blue-500: #3b82f6
- blue-400: #60a5fa (current speaker-interviewer color)
```

**Speaker Identification**:
```
Interviewer: #60a5fa (blue-400) - keep current
User: #34d399 (green-400) - keep current
```

### Text Colors

**Hierarchy**:
```
Primary: rgba(255, 255, 255, 0.98) - highest emphasis
Secondary: rgba(255, 255, 255, 0.75) - medium emphasis
Muted: rgba(255, 255, 255, 0.55) - low emphasis
Subtle: rgba(255, 255, 255, 0.38) - minimal emphasis
Disabled: rgba(255, 255, 255, 0.25) - disabled state
```

**Contrast Ratios** (against dark backgrounds):
- Primary text: >7:1 (AAA standard)
- Secondary text: >4.5:1 (AA standard)
- Muted text: >4.5:1 on elevated surfaces

### Background Colors

**Layering System**:
```
Deep (Base): rgba(10, 10, 15, 0.95) - main container
Primary: rgba(255, 255, 255, 0.04) - cards/sections
Secondary: rgba(255, 255, 255, 0.08) - elevated cards
Elevated: rgba(255, 255, 255, 0.12) - modals/popovers
Hover: rgba(255, 255, 255, 0.14) - hover states
Active: rgba(255, 255, 255, 0.18) - active/pressed states
```

### Border Colors

**Hierarchy**:
```
Subtle: rgba(255, 255, 255, 0.06) - minimal separation
Default: rgba(255, 255, 255, 0.10) - standard borders
Strong: rgba(255, 255, 255, 0.16) - emphasized borders
Focus: rgba(99, 102, 241, 0.5) - focus rings
```

### Color Accessibility

**WCAG 2.1 Requirements**:
- Normal text (< 18px): Minimum 4.5:1 contrast ratio
- Large text (≥ 18px or 14px bold): Minimum 3:1 contrast ratio
- UI components and graphics: Minimum 3:1 contrast ratio

**Testing**: Use WebAIM Contrast Checker for all color combinations

---

## 4. Typography

### Font Families

**Current**: Inter for sans-serif, JetBrains Mono for monospace
**Recommendation**: Keep Inter, it's perfect for modern UI

**Font Stack**:
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
```

**Why Inter?**:
- Designed specifically for screens
- Excellent legibility at small sizes
- Wide range of weights (100-900)
- Variable font support
- Open source and widely used (Notion, GitHub, many modern tools)

### Type Scale

**8pt Grid Compatible Scale**:
```
xs:   11px / 0.6875rem  (line-height: 16px)
sm:   12px / 0.75rem    (line-height: 16px)
base: 13px / 0.8125rem  (line-height: 20px) - primary UI text
md:   14px / 0.875rem   (line-height: 20px)
lg:   16px / 1rem       (line-height: 24px)
xl:   18px / 1.125rem   (line-height: 28px)
2xl:  20px / 1.25rem    (line-height: 28px)
3xl:  24px / 1.5rem     (line-height: 32px)
```

**Usage Guidelines**:
- **11px (xs)**: Metadata, timestamps, helper text
- **12px (sm)**: Secondary text, labels, captions
- **13px (base)**: Primary UI text, body text
- **14px (md)**: Emphasized text, button labels
- **16px (lg)**: Section headers, important labels
- **18px+ (xl-3xl)**: Modal titles, page headers

### Font Weights

```
Regular: 400   - body text
Medium:  500   - labels, emphasized text
Semibold: 600  - headings, active states
Bold: 700      - strong emphasis (use sparingly)
```

**Recommendation**: Use Medium (500) and Semibold (600) as primary weights for UI. Reserve Bold (700) for special emphasis.

### Line Height

**General Rules**:
- UI text: 1.4-1.6 multiplier (tight)
- Body text: 1.5-1.75 multiplier (comfortable)
- Code blocks: 1.6-1.8 multiplier (spacious)

**Specific Values**:
```
Tight: 1.25    - headings
Normal: 1.5    - UI text
Relaxed: 1.625 - body text
Loose: 1.75    - long-form content
```

### Letter Spacing

```
Tighter: -0.02em  - large headings
Tight: -0.01em    - medium headings
Normal: 0         - body text
Wide: 0.01em      - small caps, labels
Wider: 0.05em     - all caps
```

**Usage**:
- Headings (≥18px): Use tight or tighter
- Body text (13-16px): Use normal
- Labels/metadata: Use wide for emphasis

---

## 5. Spacing & Layout

### 8-Point Grid System

**Why 8pt Grid?**:
- Scalable across all screen densities
- Most screen sizes divisible by 8
- Integrates perfectly with Tailwind CSS
- Industry standard (used by Figma, Material Design, etc.)

**Base Unit**: 8px (0.5rem)

### Spacing Scale

**Tailwind-Compatible Scale**:
```
0:   0px
0.5: 2px   (0.125rem) - hairline
1:   4px   (0.25rem)  - minimal
1.5: 6px   (0.375rem) - tight
2:   8px   (0.5rem)   - base unit
2.5: 10px  (0.625rem)
3:   12px  (0.75rem)
3.5: 14px  (0.875rem)
4:   16px  (1rem)     - standard
5:   20px  (1.25rem)
6:   24px  (1.5rem)   - comfortable
8:   32px  (2rem)     - spacious
10:  40px  (2.5rem)
12:  48px  (3rem)
16:  64px  (4rem)
20:  80px  (5rem)
```

### Component Spacing Guidelines

**Internal Padding** (within components):
```
Compact:     8px  (p-2)  - badges, small chips
Default:     12px (p-3)  - buttons, inputs
Comfortable: 16px (p-4)  - cards, panels
Spacious:    24px (p-6)  - modals, large containers
```

**External Margins** (between components):
```
Tight:       8px  (gap-2)  - related items
Default:     12px (gap-3)  - standard spacing
Comfortable: 16px (gap-4)  - sections
Loose:       24px (gap-6)  - major sections
```

**Specific Component Recommendations**:

**Header**:
- Padding: 10-12px vertical, 14-16px horizontal
- Height: 48-56px total
- Icon buttons: 28-32px (7-8 spacing units)

**Cards/Panels**:
- Padding: 12-16px (3-4 spacing units)
- Gap between cards: 12px (3 spacing units)

**Modals**:
- Padding: 24px (6 spacing units)
- Title margin bottom: 16px (4 spacing units)
- Button spacing: 8-12px (2-3 spacing units)

**Forms**:
- Input height: 32-40px
- Label margin bottom: 6-8px (1.5-2 spacing units)
- Field gap: 16-20px (4-5 spacing units)

### Border Radius

**Scale**:
```
sm:  6px   - small elements, badges
md:  8px   - buttons, inputs
lg:  12px  - cards, panels
xl:  16px  - large cards, modals
2xl: 20px  - hero elements
full: 999px - circular elements
```

**Current Config**: Already well-defined (`glass-sm: 8px`, `glass-md: 12px`, etc.)
**Recommendation**: Slightly reduce from current values for a more modern, subtle look

**Updated Recommendations**:
```
glass-sm: 6px  (instead of 8px)
glass-md: 10px (instead of 12px)
glass-lg: 14px (instead of 16px)
glass-xl: 18px (instead of 20px)
```

### Container Widths

**Overlay Window**:
- Default: 420-480px width (comfortable for reading)
- Minimized: 280px width (current is good)
- Maximum height: Respect screen bounds with safe margins

**Content Width**:
- Optimal reading width: 520-680px (65-75 characters)
- For overlay: 360-420px inner content width

---

## 6. Iconography

### Icon Library

**Current**: Custom icons in Icons.tsx
**Recommendation**: Migrate to Lucide Icons for consistency and maintainability

**Why Lucide?**:
- Community-driven fork of Feather Icons
- Over 1,600+ icons (actively maintained)
- Minimalist, neutral, modern style with curved corners and sharp ends
- Line and fill variants available
- Highly customizable (size, stroke width, color)
- Excellent for glassmorphic UIs
- Used by shadcn/ui, Radix UI, and many modern apps

**Alternative**: Phosphor Icons
- 9,000+ icons
- Six weights: thin, light, regular, bold, fill, duotone
- Designed at 16x16px for excellent small-size legibility
- Great for applications needing visual variety

**Recommendation**: Use Lucide for consistency with modern React ecosystems

### Icon Sizing

**Scale**:
```
xs:  12px - metadata icons
sm:  14px - inline icons, small badges
md:  16px - standard UI icons (buttons, inputs)
lg:  20px - emphasized icons
xl:  24px - header icons, feature icons
2xl: 32px - hero icons, empty states
```

**Stroke Width**:
```
Thin: 1.25px    - delicate, large icons
Default: 1.5px  - standard icons
Medium: 2px     - emphasized icons
Bold: 2.5px     - strong emphasis, logos
```

**Current Usage**: Mix of sizes (14px, 15px, 16px, 26px)
**Recommendation**: Standardize to scale above

### Icon Style Guidelines

**Consistency**:
- Use single icon family throughout app
- Consistent stroke width (1.5-2px recommended)
- Consistent corner radius
- Line style preferred over filled for most UI icons

**Semantic Usage**:
- Settings: Gear/cog icon
- Help: Question mark or info icon
- Close: X icon
- Minimize: Minimize/dash icon
- Status: Dot or pulse icon

**Color**:
- Default state: `text-muted` (rgba(255, 255, 255, 0.55))
- Hover state: `text-primary` (rgba(255, 255, 255, 0.98))
- Active state: `text-accent` (indigo-500)

---

## 7. Component Design Patterns

### Buttons

**Types & Hierarchy**:

**Primary Button** (highest emphasis):
```
Background: gradient from indigo-500 to violet-600
Text: white (rgba(255, 255, 255, 0.98))
Padding: 8-12px vertical, 16-24px horizontal
Border-radius: 8-10px
Shadow: 0 2px 8px rgba(99, 102, 241, 0.4)
Hover: Slight brightness increase, lift shadow
```

**Secondary Button** (medium emphasis):
```
Background: rgba(255, 255, 255, 0.08)
Text: rgba(255, 255, 255, 0.95)
Border: 1px solid rgba(255, 255, 255, 0.12)
Hover: rgba(255, 255, 255, 0.12)
```

**Ghost Button** (low emphasis):
```
Background: transparent
Text: rgba(255, 255, 255, 0.75)
Hover: rgba(255, 255, 255, 0.08)
```

**Icon Button** (current header buttons):
```
Size: 28-32px square
Padding: 6-8px
Background: transparent
Hover: rgba(255, 255, 255, 0.10)
Active: rgba(255, 255, 255, 0.14)
Border-radius: 6-8px
```

**Transitions**:
```
Duration: 150ms (fast) for color/background changes
Duration: 250ms (normal) for transforms
Easing: ease-out or cubic-bezier(0.4, 0, 0.2, 1)
```

### Cards & Panels

**Base Card**:
```
Background: rgba(255, 255, 255, 0.05)
Border: 1px solid rgba(255, 255, 255, 0.08)
Border-radius: 12px
Padding: 16px
Backdrop-blur: 16px
Shadow: 0 4px 16px rgba(0, 0, 0, 0.2)
```

**Elevated Card** (modals, popovers):
```
Background: rgba(255, 255, 255, 0.10)
Border: 1px solid rgba(255, 255, 255, 0.12)
Border-radius: 16px
Padding: 24px
Backdrop-blur: 24px
Shadow: 0 8px 32px rgba(0, 0, 0, 0.3)
```

**Interactive Card**:
```
Add hover state:
- Background: rgba(255, 255, 255, 0.08)
- Border: rgba(255, 255, 255, 0.14)
- Transform: translateY(-1px) (subtle lift)
- Shadow: 0 6px 20px rgba(0, 0, 0, 0.25)
- Cursor: pointer
```

### Inputs & Forms

**Text Input**:
```
Background: rgba(255, 255, 255, 0.05)
Border: 1px solid rgba(255, 255, 255, 0.10)
Border-radius: 8px
Padding: 8px 12px
Height: 36-40px
Font-size: 13-14px
Placeholder: rgba(255, 255, 255, 0.4)

Focus state:
- Border: 2px solid rgba(99, 102, 241, 0.6)
- Background: rgba(255, 255, 255, 0.08)
- Shadow: 0 0 0 3px rgba(99, 102, 241, 0.15)
```

**Textarea**:
```
Same as input but:
- Min-height: 80px
- Padding: 10px 12px
- Resize: vertical only
```

**Label**:
```
Font-size: 12-13px
Font-weight: 500
Color: rgba(255, 255, 255, 0.75)
Margin-bottom: 6-8px
```

### Badges & Tags

**Status Badge** (current StatusIndicator):
```
Height: 20-24px
Padding: 4px 8px
Border-radius: 6px (full rounded)
Font-size: 11px
Font-weight: 500
```

**Colors by State**:
- Active/Success: green background + green glow
- Warning/Idle: amber background + amber glow
- Error: red background + red glow
- Neutral: gray background, no glow

**Animated States**:
- Pulse animation for active states
- Glow effect for emphasis

### Modals & Overlays

**Modal Backdrop**:
```
Background: rgba(0, 0, 0, 0.6)
Backdrop-blur: 8px
Animation: fade-in 200ms
```

**Modal Container**:
```
Background: rgba(20, 20, 30, 0.95)
Border: 1px solid rgba(255, 255, 255, 0.12)
Border-radius: 16px
Padding: 24px
Max-width: 480-560px
Backdrop-blur: 40px
Shadow: 0 20px 60px rgba(0, 0, 0, 0.5)
```

**Modal Header**:
```
Margin-bottom: 20px
Font-size: 18-20px
Font-weight: 600
Color: rgba(255, 255, 255, 0.98)
```

**Modal Footer**:
```
Margin-top: 24px
Padding-top: 16px
Border-top: 1px solid rgba(255, 255, 255, 0.08)
Display: flex
Justify-content: flex-end
Gap: 8-12px
```

### Scrollbars

**Custom Glass Scrollbar**:
```
Width: 6-8px
Track: transparent or rgba(255, 255, 255, 0.02)
Thumb: rgba(255, 255, 255, 0.15)
Thumb (hover): rgba(255, 255, 255, 0.25)
Border-radius: 4px (rounded)
```

**Implementation**:
```css
.glass-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.glass-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.glass-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
.glass-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
```

---

## 8. Micro-interactions & Animation

### Animation Philosophy (2026)

**Core Principle**: Motion isn't about impressing users—it's about guiding, reassuring, and emotionally connecting with them. The best animations are ones users don't consciously notice but would deeply miss if removed.

**Key Insights**:
- Apps with quality motion log 15-20% longer sessions
- Micro-interactions make users 45% more engaged
- Ideal duration: 200-500ms (long enough to notice, short enough to maintain flow)

### Animation Principles

**Purpose-Driven Motion**:
- Guide users through transitions
- Provide feedback for actions
- Show system status
- Create emotional connection
- Never animate without purpose

**Performance First**:
- Use transform and opacity for animations (GPU-accelerated)
- Avoid animating width, height, top, left (triggers layout/paint)
- Use `will-change` sparingly and only when needed
- Prefer CSS animations over JavaScript for simple effects

### Timing & Easing

**Duration Scale**:
```
instant: 50ms    - immediate feedback (rare)
fast:    150ms   - micro-interactions (hover, focus)
normal:  250ms   - standard transitions (modal open, slide)
slow:    400ms   - complex transitions (page change)
slower:  600ms   - dramatic effects (rare)
```

**Easing Functions**:
```
ease-out:  cubic-bezier(0, 0, 0.2, 1)     - entering elements
ease-in:   cubic-bezier(0.4, 0, 1, 1)     - exiting elements
ease:      cubic-bezier(0.4, 0, 0.2, 1)   - general purpose
spring:    cubic-bezier(0.34, 1.56, 0.64, 1) - playful bounce
```

**Usage**:
- Entering/appearing: use ease-out (starts fast, ends slow)
- Exiting/disappearing: use ease-in (starts slow, ends fast)
- Changing state: use ease (smooth throughout)

### Common Micro-interactions

**Button Hover**:
```css
transition: all 150ms ease-out;
/* Hover */
transform: translateY(-1px);
background: lighter shade;
shadow: increased;
```

**Button Click/Active**:
```css
transition: all 100ms ease-in;
transform: scale(0.98);
```

**Icon Hover**:
```css
transition: color 150ms ease-out, transform 150ms ease-out;
/* Hover */
color: brighter;
transform: scale(1.1) or rotate(90deg) for settings icon;
```

**Card Hover**:
```css
transition: all 250ms ease-out;
transform: translateY(-2px);
shadow: elevated;
border-color: brighter;
```

**Modal Enter**:
```css
/* Backdrop */
opacity: 0 → 1 (200ms ease-out)
backdrop-blur: 0 → 8px

/* Modal */
opacity: 0 → 1 (250ms ease-out)
transform: translateY(20px) → translateY(0)
```

**Modal Exit**:
```css
opacity: 1 → 0 (150ms ease-in)
transform: scale(1) → scale(0.95)
```

**Toast Notification**:
```css
/* Enter */
opacity: 0 → 1 (200ms ease-out)
transform: translateY(12px) → translateY(0)

/* Exit */
opacity: 1 → 0 (150ms ease-in)
transform: translateY(0) → translateY(-8px)
```

### Loading States & Streaming

**Smart Loading States**:

**Skeleton Screens** (preferred over spinners):
```
Use pulsing gradient animation
Mimic content structure
Animate: opacity 1.5s ease-in-out infinite
```

**Progress Indicators**:
```
Pulsing dots (for streaming/generating)
Breathing progress bar (subtle scale animation)
Duration: 1.5-2s cycles
```

**Streaming Text Animation**:
```
New content fades in (150ms)
Cursor blinks at end (1s interval)
Auto-scroll smooth behavior
```

**Spinner** (when progress unknown):
```css
animation: spin 0.8s linear infinite;
size: 16-20px
stroke-width: 2px
color: indigo-400
```

### Status Transitions

**Live Mode Indicator**:
```
Idle → Active:
  - Color transition: gray → green (250ms)
  - Add pulse animation (infinite)
  - Add glow shadow (250ms)

Active → Error:
  - Color transition: green → red (250ms)
  - Change pulse to blink animation
  - Shake animation (subtle, 300ms, one-time)
```

**AI Response Streaming**:
```
Start state:
  - Show typing indicator (pulsing dots, 1.5s cycle)

Streaming:
  - Each word/token fades in (150ms ease-out)
  - Smooth auto-scroll
  - Cursor blinks at end

Complete:
  - Fade out cursor (300ms)
  - Optional: subtle scale-in of full content (200ms)
```

### Gesture Feedback

**Drag Handle** (for window repositioning):
```
Hover:
  - Cursor: move or grab
  - Opacity increase (150ms)

Active/Dragging:
  - Cursor: grabbing
  - Optional: slight scale or glow
```

### Reduced Motion Support

**Critical**: Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Alternative for reduced motion**:
- Use instant state changes
- Keep opacity transitions (generally safe)
- Remove transforms, bounces, springs

---

## 9. Accessibility Standards

### WCAG 2.1 Compliance

**Target Level**: AA (minimum), AAA (where possible)

**2026 Legal Requirements**:
- Department of Justice mandated WCAG 2.1 A and AA compliance
- Deadlines: 2026 for large entities, 2027 for smaller organizations
- Accessibility is no longer optional

### Color Contrast Requirements

**WCAG 2.1 Standards**:
- Normal text (<18px): **4.5:1 minimum** (AA), 7:1 (AAA)
- Large text (≥18px or ≥14px bold): **3:1 minimum** (AA), 4.5:1 (AAA)
- UI components & graphics: **3:1 minimum**

**Testing Tools**:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [AllAccessible Color Contrast Checker](https://www.allaccessible.org/color-contrast-checker)
- Built into browser DevTools

**Implementation**:
- Test all text colors against all background colors they appear on
- Remember: glassmorphism can ruin contrast if not careful
- Always use white or near-white text on dark glass backgrounds
- High-contrast mode option should be available

### Dark Mode Best Practices

**Avoid Pure Black**:
- Pure black (#000000) causes eye strain and "halation effect"
- Use dark grays: #0a0a0f, #12121a, #1a1a24
- Ensure contrast ratio still meets WCAG 1.4.3

**Important Caveat**:
- Offering dark mode doesn't satisfy WCAG requirements
- Both light and dark modes must meet contrast standards independently
- Cannot use "we have high contrast mode" as excuse for poor default contrast

### Keyboard Accessibility

**All Interactive Elements**:
- Must be keyboard accessible (Tab, Enter, Space, Arrows)
- Must have visible focus indicators
- Tab order must be logical
- Keyboard shortcuts must not conflict with screen readers

**Focus Indicators**:
```css
Focus ring:
- Outline: 2px solid rgba(99, 102, 241, 0.6)
- Outline-offset: 2px
- Shadow: 0 0 0 3px rgba(99, 102, 241, 0.15)
- Border-radius: inherit from element
```

**Skip links**:
- Provide "Skip to main content" for keyboard users
- Hidden until focused

### Screen Reader Support

**Semantic HTML**:
- Use proper heading hierarchy (h1 → h2 → h3)
- Use `<button>` for buttons, not `<div>` with click handlers
- Use `<nav>`, `<main>`, `<aside>`, `<section>` landmarks
- Use `<label>` for form inputs

**ARIA Attributes**:
```html
<!-- Live regions for dynamic content -->
<div aria-live="polite" aria-atomic="true">
  Status updates, transcripts
</div>

<!-- Buttons -->
<button aria-label="Close modal">
  <CloseIcon />
</button>

<!-- Status indicators -->
<span role="status" aria-live="polite">
  Connected
</span>

<!-- Loading states -->
<div role="status" aria-live="polite" aria-busy="true">
  Generating response...
</div>
```

**Live Regions**:
- Transcript updates: `aria-live="polite"`
- Streaming AI responses: `aria-live="polite"`
- Error messages: `aria-live="assertive"`
- Status changes: `aria-live="polite"`

### Form Accessibility

**Labels**:
- Every input must have associated label
- Use `<label for="id">` or `aria-label`

**Error Messaging**:
```html
<input
  aria-invalid="true"
  aria-describedby="error-message"
/>
<span id="error-message" role="alert">
  API key is required
</span>
```

**Validation**:
- Show errors inline, near the field
- Use color + icon + text (not color alone)
- Announce errors to screen readers via `role="alert"`

### Motion & Animation

**Reduced Motion**:
```css
@media (prefers-reduced-motion: reduce) {
  /* Disable or minimize animations */
}
```

**Implementation**:
- Detect user preference
- Disable decorative animations
- Keep essential feedback (opacity changes, instant state changes)

### Touch Targets

**Minimum Size**: 44×44px (iOS), 48×48px (Android/WCAG)

**Current Implementation**:
- Header buttons: 28px (too small)
- **Recommendation**: Increase to 32-36px or add padding to reach 44px touch target

**Spacing**:
- Minimum 8px between touch targets
- Prefer 12px or more for comfort

### Testing Checklist

- [ ] All text meets 4.5:1 contrast ratio (or 3:1 for large text)
- [ ] All interactive elements keyboard accessible
- [ ] Visible focus indicators on all focusable elements
- [ ] Logical tab order
- [ ] Screen reader announces dynamic content
- [ ] Form errors clearly associated with fields
- [ ] Color not used as only means of conveying information
- [ ] Reduced motion preference respected
- [ ] Touch targets at least 44×44px
- [ ] Semantic HTML structure
- [ ] ARIA attributes used appropriately

---

## 10. AI Interface Patterns

### Emerging Design Patterns (2026)

Based on research from ChatGPT, GitHub Copilot, Microsoft Copilot, and other leading AI interfaces.

### Conversational UI Principles

**Clarity & Responsiveness**:
- Clear, intuitive, and responsive
- Short messages, structured options, visual cues
- Consistent with brand tone and style

**Flexibility**:
- Support voice input, file uploads, standard text
- Multiple input modalities enhance ease of use

**Minimal & Calm**:
- Ample white space (or dark space)
- Subtle branding
- Focus on content, not interface

### Dynamic Content Patterns

**Streaming Text**:
- Show tokens as they arrive (don't wait for full response)
- Word-by-word fade-in (150ms per token group)
- Typing indicator at cursor position
- Smooth auto-scroll to latest content

**Governor Mechanisms**:
- Show AI-generated content at partial opacity until approved
- Builds trust and gives users control
- Especially important for high-stakes outputs

**Provisional Content**:
```css
.ai-generated-unconfirmed {
  opacity: 0.6;
  border-left: 2px solid amber-500;
  position: relative;
}

.ai-generated-confirmed {
  opacity: 1;
  border-left: 2px solid green-500;
}
```

### Transparency & Trust

**Restating Interpretation**:
- Show what the AI understood from input
- Allow users to correct before processing
- Example: "Generating answer for: [question]"

**Confidence Levels** (when applicable):
- Show uncertainty when AI isn't sure
- Use visual indicators (strength bars, percentages)
- "I'm not certain, but..." messaging

**Undo/Redo Actions**:
- Allow users to revert AI actions
- Provide edit capability
- Show history of modifications

### Context Display

**Conversation History**:
- Show recent context (last 60 seconds for transcripts)
- Group by speaker for readability
- Visual distinction between speakers
- Timestamps for reference

**Rolling Context Indicator**:
- Show how much context is being maintained
- Example: "Using last 20 minutes of conversation"
- Help users understand what AI "knows"

### Loading & Generating States

**Better than Spinners**:
- "Thinking..." with subtle animation
- "Generating response..." with progress indication
- Pulsing dots (3 dots, sequential animation)

**Progress Information**:
- Show real progress when possible
- "Processing transcript (450 words)..."
- "Analyzing question..."
- "Generating answer..."

**Smart Skeletons**:
- Show placeholder structure while loading
- Pulsing gradient animation
- Matches expected content layout

### Error States

**AI-Specific Errors**:

**Rate Limits**:
```
Message: "Too many requests. Please wait 30 seconds."
Visual: Warning color, timer countdown
Action: Automatic retry or manual retry button
```

**Context Too Long**:
```
Message: "Context exceeds limit. Using last 15 minutes only."
Visual: Info color, context indicator
Action: Option to clear older context
```

**API Errors**:
```
Message: "Unable to generate response. Please try again."
Visual: Error color, retry button
Action: Clear retry option, check API key button
```

**No Context Available**:
```
Message: "No conversation context yet. Start transcription first."
Visual: Info color, helpful guidance
Action: Button to start Live Mode
```

### Suggested Actions

**Prompt Suggestions**:
- Show suggested questions/actions
- "Try asking..." or "You can also..."
- Contextual based on current state

**Quick Actions**:
- Buttons for common tasks
- "Clear transcript", "Regenerate", "Copy answer"
- Icon + label format

### User as "Agent Boss" Pattern

**Microsoft Copilot 365 Approach**:
- Position user as director of AI system
- AI provides options, user makes decisions
- Clear hierarchy: user is in control

**Implementation**:
- Always provide escape hatches
- Allow interruption of generation
- Give manual override options

---

## 11. Keyboard-First Design

### Command Palette Philosophy

**Inspiration**: Raycast, VS Code, Spotlight, Notion

**Core Benefits**:
- Complete tasks with fewer clicks/keystrokes
- Single entry point for all functionality
- Especially beneficial for power users
- Reduces screen real estate needs
- Fast, predictable, efficient

### Current Keyboard Shortcuts

**Existing** (from README):
```
Cmd+Shift+L - Toggle Live Mode
Cmd+Shift+X - Generate Answer
Cmd+Shift+Z - Clear Overlay
Cmd+Shift+M - Toggle Minimize Mode
```

**Assessment**: Good foundation, room for expansion

### Recommended Additions

**Essential Shortcuts**:
```
Cmd+K or Cmd+Shift+P - Command Palette (future feature)
Cmd+, (Comma) - Open Settings (standard convention)
Cmd+/ (Slash) - Open Help (standard convention)
Cmd+W - Close Window (standard convention)
Escape - Close Modal/Dismiss (when applicable)
```

**Power User Features**:
```
Cmd+C - Copy AI Answer (when focused)
Cmd+Shift+C - Copy Transcript (when focused)
Cmd+R - Regenerate Answer (when in answer view)
Cmd+E - Edit System Prompt (quick access)
Cmd+1, Cmd+2, etc. - Switch between sections (if applicable)
```

### Shortcut Design Guidelines

**Be OS-Aware**:
- Display correct shortcuts for user's OS
- Cmd for macOS, Ctrl for Windows/Linux
- Wrong OS shortcuts damage credibility

**Standard Conventions**:
- Cmd+, for Settings (universal standard)
- Cmd+/ for Help (GitHub, VS Code, etc.)
- Cmd+W for Close Window
- Escape for Cancel/Dismiss

**Avoid Conflicts**:
- Don't override system shortcuts
- Don't conflict with common app shortcuts
- Test in target applications (Zoom, browsers, etc.)

**Progressive Disclosure**:
- Show shortcuts in tooltips
- Highlight shortcuts when user repeatedly uses mouse
- Example: "You've clicked Settings 3 times. Try Cmd+,"

**Visual Indicators**:
```html
<!-- Keyboard shortcut display -->
<kbd class="glass-kbd">⌘</kbd>
<kbd class="glass-kbd">K</kbd>
```

```css
.glass-kbd {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.2;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
```

### Focus Management

**Tab Order**:
- Logical flow: top to bottom, left to right
- Skip non-interactive elements
- Use `tabindex="0"` for custom controls
- Use `tabindex="-1"` to remove from tab order

**Focus Trapping**:
- Modal open: trap focus within modal
- Escape key: close modal and restore focus
- Use `focus-trap` library or custom implementation

**Focus Indicators**:
- Always visible (never `outline: none` without replacement)
- High contrast (4.5:1 minimum)
- Clear visual distinction

### Accessibility

**Screen Reader Announcements**:
```html
<!-- Announce shortcut availability -->
<span class="sr-only">
  Press Cmd+Shift+L to start transcription
</span>
```

**Skip Links**:
```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--accent);
  color: white;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

---

## 12. Real-time Transcription UI

### Technical Requirements

**Performance Targets**:
- Sub-500ms latency for natural conversation flow
- 1-3 second delay acceptable for captions
- 85-95% accuracy in typical conditions
- Word-level timestamps for synchronization

**Architecture**:
- Partial results display (interim text)
- Final results update (finalized segments)
- Speaker identification
- Automatic scrolling

### Display Patterns

**Current Implementation**:
- Shows last 60 seconds of conversation
- Groups segments by speaker
- Interim text with reduced opacity
- Auto-scroll to latest content

**Recommendations**: Generally good, refinements below

### Speaker Identification

**Visual Differentiation**:

**Color-coded** (current approach is good):
```
Interviewer: #60a5fa (blue-400)
You: #34d399 (green-400)
```

**Enhanced Visual Pattern**:
```html
<div class="transcript-segment">
  <div class="speaker-badge interviewer">
    <div class="speaker-indicator"></div>
    <span>Interviewer</span>
  </div>
  <div class="transcript-text">
    [Transcript content]
  </div>
</div>
```

```css
.speaker-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 500;
  opacity: 0.75;
}

.speaker-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.speaker-badge.interviewer {
  color: #60a5fa;
}

.speaker-badge.you {
  color: #34d399;
}
```

### Interim vs. Final Text

**Current**: Reduced opacity for interim
**Enhancement**: Add visual distinction

```css
.transcript-interim {
  opacity: 0.5;
  font-style: italic;
  position: relative;
}

.transcript-interim::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 14px;
  background: currentColor;
  margin-left: 2px;
  animation: blink 1s step-end infinite;
}

.transcript-final {
  opacity: 1;
}
```

### Timestamps

**Current**: Optional timestamps (showTimestamps={false})
**Recommendation**: Add toggle option in settings

**Timestamp Display**:
```html
<span class="transcript-timestamp">12:34 PM</span>
<div class="transcript-text">...</div>
```

```css
.transcript-timestamp {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
  margin-right: 8px;
}
```

**Format**: Relative time ("2s ago", "30s ago") or absolute (HH:MM:SS)

### Scrolling Behavior

**Auto-scroll**:
- Scroll to latest content when new text arrives
- Disable auto-scroll when user scrolls up (viewing history)
- Re-enable when user scrolls to bottom
- Visual indicator: "New messages below" ↓

**Smooth Scrolling**:
```css
scroll-behavior: smooth;
```

```javascript
// Scroll to bottom
transcriptContainer.scrollTo({
  top: transcriptContainer.scrollHeight,
  behavior: 'smooth'
});
```

### Performance Optimization

**Virtualization** (for very long transcripts):
- Render only visible segments
- Use `react-window` or `react-virtuoso`
- Threshold: 100+ segments

**Debouncing**:
- Batch interim updates (every 100-200ms)
- Avoid re-rendering for every single word

**Memory Management**:
- Keep 20-minute rolling window (current: good)
- Automatically prune old segments
- Store full history separately if needed

### Empty States

**No Transcript Yet**:
```html
<div class="empty-state">
  <MicIcon size={32} />
  <p class="text-muted">
    No transcript yet
  </p>
  <p class="text-subtle text-sm">
    Press Cmd+Shift+L to start Live Mode
  </p>
</div>
```

**Waiting for Audio**:
```html
<div class="loading-state">
  <PulsingDots />
  <p class="text-muted">
    Listening...
  </p>
</div>
```

### Accuracy Indicators

**Confidence Display** (optional, if API provides):
- High confidence: normal opacity
- Medium confidence: slightly reduced opacity
- Low confidence: italic + reduced opacity

**Error Correction**:
- Allow manual editing of transcript (future feature)
- Show corrections with different styling

### Speaker Diarization

**Current**: Speaker identification (interviewer vs. you)
**Enhancement**: Visual timeline

**Timeline View** (optional advanced feature):
```
[You ████    ] [Interviewer ██████] [You ███]
0:00        0:30              1:00        1:30
```

Shows speaking distribution over time

### Accessibility

**Screen Reader Support**:
```html
<div
  role="log"
  aria-live="polite"
  aria-relevant="additions"
  aria-label="Live transcript"
>
  <!-- Transcript segments -->
</div>
```

**Keyboard Navigation**:
- Arrow keys to navigate segments
- Cmd+C to copy selected segment
- Cmd+Shift+C to copy entire transcript

---

## 13. Implementation Recommendations

### Phase 1: Foundation (Highest Priority)

**1. Color System Refinement**
- Update background colors to softer dark grays (not pure black)
- Implement ambient gradient background layer
- Test all text colors for WCAG 2.1 AA compliance
- Add high-contrast mode option

**Estimated Impact**: High - improves aesthetics and accessibility

**2. Accessibility Compliance**
- Add proper ARIA labels to all interactive elements
- Implement visible focus indicators (2px outline + 3px shadow)
- Increase touch targets to 44×44px minimum
- Add `prefers-reduced-motion` support
- Implement skip links

**Estimated Impact**: Critical - legal requirement, better UX

**3. Typography & Spacing Standardization**
- Audit all font sizes and standardize to type scale
- Apply 8pt grid to all spacing (currently inconsistent)
- Reduce border radius slightly for modern look
- Ensure line heights are comfortable (1.5-1.6 for UI)

**Estimated Impact**: Medium - cleaner, more consistent design

### Phase 2: Visual Polish

**1. Icon System**
- Migrate to Lucide Icons for consistency
- Standardize icon sizes (12px, 14px, 16px, 20px, 24px)
- Ensure consistent stroke width (1.5-2px)
- Add subtle hover animations

**Estimated Impact**: Medium - more polished, maintainable

**2. Micro-interactions**
- Add smooth transitions to all interactive elements (150-250ms)
- Implement button hover effects (lift + shadow)
- Add loading state animations (pulsing skeletons)
- Enhance status indicator animations

**Estimated Impact**: Medium-High - significantly improves feel

**3. Glass Effects Refinement**
- Add ambient gradient background layer
- Refine blur values for better performance
- Add subtle glow effects to accent elements
- Implement better shadow system

**Estimated Impact**: High - core visual identity improvement

### Phase 3: Enhanced Functionality

**1. Keyboard Shortcuts Expansion**
- Add Cmd+, for Settings
- Add Cmd+/ for Help
- Add Escape key support for modals
- Implement progressive disclosure of shortcuts

**Estimated Impact**: Medium - power user satisfaction

**2. Improved Status & Feedback**
- Better toast notification system (max 3 lines)
- Inline error messaging with icons
- Loading skeletons instead of spinners
- Clear progress indicators for AI generation

**Estimated Impact**: Medium - better communication

**3. Real-time Transcript Enhancements**
- Add timestamp toggle option
- Improve speaker differentiation
- Add copy functionality
- Implement auto-scroll with manual override

**Estimated Impact**: Medium - better usability

### Phase 4: Advanced Features (Future)

**1. Command Palette**
- Implement Cmd+K command palette
- Searchable actions
- Recent actions history
- Keyboard navigation

**Estimated Impact**: High for power users

**2. Customization Options**
- Accent color picker
- Font size adjustment
- Blur intensity control
- Compact/comfortable/spacious density modes

**Estimated Impact**: Medium - user preference

**3. Enhanced AI Interaction**
- Governor mechanism (provisional content)
- Confidence indicators
- Inline editing of responses
- Response history/versioning

**Estimated Impact**: Medium-High - advanced AI UX

### Quick Wins (Can Implement Immediately)

1. **Soften background color**: Change from pure black to #0a0a0f
2. **Add ambient gradient**: Implement subtle colored orbs
3. **Increase touch targets**: Header buttons from 28px to 36px
4. **Add focus indicators**: 2px outline + 3px shadow on focus
5. **Reduce border radius**: From 8/12/16/20 to 6/10/14/18
6. **Standardize icon sizes**: Use 14/16/20/24px only
7. **Add reduced motion support**: @media query for animations
8. **Improve button hover**: Add translateY(-1px) on hover
9. **Fix contrast ratios**: Test and adjust any failing colors
10. **Add keyboard shortcuts**: Cmd+, Cmd+/, Escape support

### Performance Considerations

**Monitor & Optimize**:
- Backdrop-blur can be expensive (limit layers)
- Animate transform/opacity only
- Use `will-change` strategically
- Lazy load Lucide icons if switching
- Debounce transcript updates
- Virtualize long lists if needed

**Testing**:
- Test on lower-end devices
- Monitor frame rates during animations
- Check memory usage with long transcripts
- Verify blur performance on non-Retina displays

### Testing & Validation Checklist

**Design**:
- [ ] All colors meet WCAG AA contrast (4.5:1 minimum)
- [ ] Consistent spacing using 8pt grid
- [ ] Consistent typography from type scale
- [ ] Icons from single library at standard sizes
- [ ] Border radius consistent across components

**Accessibility**:
- [ ] Keyboard navigation works throughout
- [ ] Focus indicators visible on all elements
- [ ] Screen reader announces dynamic content
- [ ] Touch targets meet 44×44px minimum
- [ ] Reduced motion preference respected
- [ ] Color not sole indicator of status/state

**Functionality**:
- [ ] All shortcuts work as expected
- [ ] No conflicts with system shortcuts
- [ ] Modals trap focus correctly
- [ ] Escape key closes modals
- [ ] Auto-scroll works and can be overridden

**Performance**:
- [ ] Smooth 60fps animations
- [ ] No layout thrashing
- [ ] Fast initial load
- [ ] Efficient re-renders
- [ ] Low memory footprint

---

## Appendix: Resources & References

### Design Inspiration

**Overlay Applications**:
- [Raycast](https://www.raycast.com/) - Command palette excellence
- [Arc Browser](https://arc.net/) - Innovative UI patterns
- macOS Spotlight - Minimal, fast search

**AI Interfaces**:
- [ChatGPT](https://chat.openai.com/) - Clean conversational UI
- [GitHub Copilot](https://github.com/features/copilot) - Inline assistance
- [Microsoft Copilot](https://copilot.microsoft.com/) - AI agent patterns

**Design Systems**:
- [Notion](https://www.notion.so/) - Typography, calm aesthetics
- [Linear](https://linear.app/) - Modern, polished UI
- [Raycast Store](https://www.raycast.com/store) - Extension UI patterns

### Icon Libraries

- [Lucide Icons](https://lucide.dev/) - Recommended, 1,600+ icons
- [Phosphor Icons](https://phosphoricons.com/) - Alternative, 9,000+ icons, 6 weights
- [Heroicons](https://heroicons.com/) - Tailwind Labs' icon set

### Color & Contrast Tools

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [AllAccessible Color Contrast Checker](https://www.allaccessible.org/color-contrast-checker)
- [Coolors](https://coolors.co/) - Palette generator
- [Accessible Colors](https://accessible-colors.com/) - WCAG-compliant color finder

### Typography Resources

- [Inter Font](https://rsms.me/inter/) - Official site
- [Modular Scale](https://www.modularscale.com/) - Type scale calculator
- [Type Scale](https://typescale.com/) - Visual type scale tool

### Animation Libraries

- [Framer Motion](https://www.framer.com/motion/) - React animation library
- [Auto Animate](https://auto-animate.formkit.com/) - Zero-config animations
- [GSAP](https://greensock.com/gsap/) - Professional animation platform

### Accessibility Resources

- [WebAIM](https://webaim.org/) - Web accessibility guidelines
- [A11y Project](https://www.a11yproject.com/) - Community-driven accessibility
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) - ARIA patterns

### Design System Tools

- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS (current stack)
- [shadcn/ui](https://ui.shadcn.com/) - Component library (uses Lucide)
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives

### Research Sources

This document is based on extensive research from 30+ sources published in 2025-2026, including:

**Overlay UI & Productivity Tools**:
- [a guide to Raycast, Perplexity AI, and Arc Browser](https://www.pixelmatters.com/insights/guide-to-raycast-perplexity-arc)
- [Spotlight vs Alfred vs Raycast](https://medium.com/@andriizolkin/spotlight-vs-alfred-vs-raycast-31bd942ac3b6)
- [Raycast API Documentation](https://developers.raycast.com/api-reference/user-interface)

**AI Interface Design**:
- [40 Chatbot UI Examples](https://arounda.agency/blog/chatbot-ui-examples)
- [Microsoft Copilot UX Guidance](https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance)
- [OpenAI UI Guidelines](https://developers.openai.com/apps-sdk/concepts/ui-guidelines/)
- [UX Best Practices for Copilot Design](https://www.uxforai.com/p/ux-best-practices-copilot-design)

**Glassmorphism Trends**:
- [Dark Glassmorphism: The Aesthetic That Will Define UI in 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [Glassmorphism: What It Is and How to Use It in 2026](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)
- [UI Design Trend 2026: Glassmorphism and Liquid Design](https://medium.com/design-bootcamp/ui-design-trend-2026-2-glassmorphism-and-liquid-design-make-a-comeback-50edb60ca81e)

**Accessibility**:
- [Dark Mode Design Best Practices in 2026](https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/)
- [Color Contrast Accessibility: Complete WCAG 2025 Guide](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025)
- [Best Practices for Accessible Color Contrast](https://developerux.com/2025/07/28/best-practices-for-accessible-color-contrast-in-ux/)

**Micro-interactions & Animation**:
- [UI/UX Evolution 2026: Micro-Interactions & Motion](https://primotech.com/ui-ux-evolution-2026-why-micro-interactions-and-motion-matter-more-than-ever/)
- [Motion Design & Micro-Interactions in 2026](https://www.techqware.com/blog/motion-design-micro-interactions-what-users-expect)
- [Motion & Microinteraction Trends: From Subtle to Delightful](https://medium.com/@Rythmuxdesigner/motion-microinteraction-trends-from-subtle-to-delightful-262f6ed360a7)

**Design Systems & Components**:
- [Spacing, grids, and layouts](https://www.designsystems.com/space-grids-and-layouts/)
- [Everything you need to know about layout grids in Figma](https://www.figma.com/best-practices/everything-you-need-to-know-about-layout-grids/)
- [Toast notifications best practices](https://blog.logrocket.com/ux-design/toast-notifications/)
- [Indicators, Validations, and Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/)

**Iconography**:
- [Better Than Lucide: 8 Icon Libraries](https://hugeicons.com/blog/design/8-lucide-icons-alternatives-that-offer-better-icons)
- [Best free icon sets for UI design 2025](https://www.adhamdannaway.com/blog/icons/free-icon-sets)
- [Modern Iconography Trends for UI 2025](https://www.laetro.com/blog/modern-iconography-ui-2025)

**Keyboard UI & Command Palettes**:
- [Command Palette UX Patterns](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)
- [The UX of Keyboard Shortcuts](https://medium.com/design-bootcamp/the-art-of-keyboard-shortcuts-designing-for-speed-and-efficiency-9afd717fc7ed)
- [How to design great keyboard shortcuts](https://knock.app/blog/how-to-design-great-keyboard-shortcuts)

**Real-time Transcription**:
- [Real-Time Speech to Text: Live Transcription Guide](https://www.assemblyai.com/blog/real-time-speech-to-text)
- [Best real-time speech-to-text apps in 2026](https://www.assemblyai.com/blog/best-real-time-speech-to-text-apps)

**Error States & Validation**:
- [10 Design Guidelines for Reporting Errors](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [Designing Better Error Messages UX](https://www.smashingmagazine.com/2022/08/error-messages-ux-design/)
- [Inline Validation UX](https://smart-interface-design-patterns.com/articles/inline-validation-ux/)

---

## Conclusion

This design guidelines document provides a comprehensive framework for modernizing Overlay AI's interface based on 2026 design trends, accessibility requirements, and best practices from leading applications.

**Key Takeaways**:

1. **Modern Glassmorphism**: Embrace dark glassmorphism with ambient gradients, improved contrast, and thoughtful layering
2. **Accessibility First**: Meet WCAG 2.1 AA standards minimum - it's legally required and benefits all users
3. **Purposeful Motion**: Use micro-interactions to guide, reassure, and connect - not just to impress
4. **Keyboard-First**: Design for power users with comprehensive keyboard shortcuts and command palette
5. **AI-Specific Patterns**: Implement streaming text, smart loading states, and transparency mechanisms
6. **Consistent System**: Use 8pt grid, standardized type scale, and cohesive icon library

**Implementation Priority**:
- Start with accessibility (Phase 1) - it's critical
- Then visual polish (Phase 2) - it's impactful
- Then enhanced functionality (Phase 3) - it's valuable
- Finally advanced features (Phase 4) - it's delightful

The goal is not to redesign everything at once, but to systematically improve the interface while maintaining the core identity and functionality that makes Overlay AI unique.

---

**Document Version**: 1.0
**Last Updated**: January 22, 2026
**Author**: Research & compilation by Claude (Anthropic)
**Based on**: 30+ sources from 2025-2026 design research
