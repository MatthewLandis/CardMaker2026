import { Component, ElementRef, afterRenderEffect, computed, input, signal, viewChild } from '@angular/core';
import { toJpeg, toPng } from 'html-to-image';
import { CardData, LINK_ARROWS, canBePendulum, hasDef, isMonster, starKind, typeLine } from './card.model';

// Size of the card images in pixels. Every overlay in assets/ is a full layer of this size.
export const CARD_WIDTH = 813;
export const CARD_HEIGHT = 1185;

/**
 * Draws a card at its real size (813x1185) by stacking the template images and positioning text on top.
 * The parent scales it down to fit the screen; exporting always uses the full size.
 */
@Component({
  selector: 'app-card-preview',
  templateUrl: './card-preview.html',
  styleUrl: './card-preview.scss',
})
export class CardPreview {
  readonly card = input.required<CardData>();

  private readonly cardEl = viewChild.required<ElementRef<HTMLElement>>('cardEl');
  private readonly nameEl = viewChild<ElementRef<HTMLElement>>('nameEl');
  private readonly typeEl = viewChild<ElementRef<HTMLElement>>('typeEl');
  private readonly atkEl = viewChild<ElementRef<HTMLElement>>('atkEl');
  private readonly defEl = viewChild<ElementRef<HTMLElement>>('defEl');
  private readonly textEl = viewChild<ElementRef<HTMLElement>>('textEl');
  private readonly pendulumTextEl = viewChild<ElementRef<HTMLElement>>('pendulumTextEl');

  /** Bumped once the card fonts finish loading, so text is re-measured with the right font. */
  private readonly fontsLoaded = signal(0);

  protected readonly monster = computed(() => isMonster(this.card().frame));
  protected readonly pendulum = computed(() => this.card().pendulum && canBePendulum(this.card().frame));
  protected readonly stars = computed(() => starKind(this.card().frame));
  protected readonly showDef = computed(() => hasDef(this.card().frame));
  protected readonly typeParts = computed(() => typeLine(this.card()));
  protected readonly arrows = computed(() => LINK_ARROWS.filter(a => this.card().linkArrows.includes(a)));
  /** Normal monsters use the italic flavor-text font. */
  protected readonly flavorText = computed(() => this.card().frame === 'Normal' && !this.pendulum());

  constructor() {
    document.fonts.ready.then(() => this.fontsLoaded.update(n => n + 1));

    // After every change, squeeze text that is too long so it fits its box, like on real cards.
    afterRenderEffect(() => {
      this.card();
      this.fontsLoaded();
      squeezeToWidth(this.nameEl()?.nativeElement, 616);
      squeezeToWidth(this.typeEl()?.nativeElement, 680);
      squeezeToWidth(this.atkEl()?.nativeElement, 80);
      squeezeToWidth(this.defEl()?.nativeElement, 80);
      shrinkToFit(this.textEl()?.nativeElement, this.flavorText() ? 26 : 29, 12);
      shrinkToFit(this.pendulumTextEl()?.nativeElement, 27, 12);
    });
  }

  /** Renders the card to an image data URL. */
  toImage(format: 'png' | 'jpeg', scale = 1): Promise<string> {
    const options = {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      pixelRatio: scale,
      quality: 0.85,
      // The preview is scaled down on screen; render the card itself at full size.
      style: { transform: 'none' },
    };
    const el = this.cardEl().nativeElement;
    return format === 'png' ? toPng(el, options) : toJpeg(el, options);
  }
}

/** Squashes text horizontally (never wider than maxWidth), keeping its height. */
function squeezeToWidth(el: HTMLElement | undefined, maxWidth: number) {
  if (!el) return;
  el.style.transform = 'none';
  const width = el.scrollWidth;
  el.style.transform = width > maxWidth ? `scaleX(${maxWidth / width})` : 'none';
}

/** Picks the largest font size (up to max) at which the text fits inside its box. */
function shrinkToFit(el: HTMLElement | undefined, max: number, min: number) {
  if (!el) return;
  let low = min;
  let high = max;
  el.style.fontSize = `${high}px`;
  if (el.scrollHeight <= el.clientHeight) return;
  while (high - low > 0.25) {
    const mid = (low + high) / 2;
    el.style.fontSize = `${mid}px`;
    if (el.scrollHeight <= el.clientHeight) low = mid;
    else high = mid;
  }
  el.style.fontSize = `${low}px`;
}
