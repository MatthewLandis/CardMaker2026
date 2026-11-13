import {
  Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, input, signal, viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService, errorMessage } from '../auth/auth.service';
import { CARD_HEIGHT, CARD_WIDTH, CardPreview } from '../card/card-preview';
import {
  ABILITIES, ATTRIBUTES, CardData, FRAMES, FRAME_COLORS, Frame, LINK_ARROWS, LinkArrow, MONSTER_TYPES,
  RARITIES, SPELL_TYPES, TRAP_TYPES, canBePendulum, effectChoice, hasDef, isMonster, newCard, normalizeCard,
  starKind,
} from '../card/card.model';
import { CardsService } from '../card/cards.service';

const DRAFT_KEY = 'cardmaker.draft';
const MAX_ART_SIZE = 1000; // uploaded art is resized to at most this many pixels per side

@Component({
  selector: 'app-editor',
  imports: [CardPreview, RouterLink],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
})
export class Editor {
  private readonly cards = inject(CardsService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  protected readonly auth = inject(AuthService);

  /** The saved card's id, from the /edit/:id URL. */
  readonly id = input<string>();

  protected readonly card = signal<CardData>(loadDraft() ?? newCard());
  protected readonly savedId = signal<number | null>(null);
  protected readonly dirty = signal(false);
  protected readonly busy = signal<'loading' | 'saving' | 'exporting' | null>(null);
  protected readonly status = signal<{ text: string; error?: boolean } | null>(null);

  // Options for the controls
  protected readonly frames = FRAMES;
  protected readonly frameColors = FRAME_COLORS;
  protected readonly rarities = RARITIES;
  protected readonly attributes = ATTRIBUTES;
  protected readonly monsterTypes = MONSTER_TYPES;
  protected readonly abilities = ABILITIES;
  protected readonly spellTypes = SPELL_TYPES;
  protected readonly trapTypes = TRAP_TYPES;
  protected readonly arrowGrid: (LinkArrow | null)[] = [...LINK_ARROWS.slice(0, 4), null, ...LINK_ARROWS.slice(4)];
  protected readonly starValues = Array.from({ length: 14 }, (_, i) => i);

  // What the current frame supports
  protected readonly monster = computed(() => isMonster(this.card().frame));
  protected readonly stars = computed(() => starKind(this.card().frame));
  protected readonly starLabel = computed(() => ({ level: 'Level', rank: 'Rank', negativeLevel: 'Negative Level', none: '' })[this.stars()]);
  protected readonly pendulumAllowed = computed(() => canBePendulum(this.card().frame));
  protected readonly effectOptional = computed(() => effectChoice(this.card().frame) === 'optional');
  protected readonly showDef = computed(() => hasDef(this.card().frame));
  protected readonly textLabel = computed(() =>
    this.card().frame === 'Normal' && !this.card().pendulum ? 'Flavor text' : 'Card text',
  );

  private readonly preview = viewChild.required(CardPreview);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  protected readonly previewScale = signal(0.5);
  protected readonly CARD_WIDTH = CARD_WIDTH;
  protected readonly CARD_HEIGHT = CARD_HEIGHT;

  constructor() {
    // Load the saved card whenever the URL's id changes
    effect(() => {
      const id = Number(this.id());
      if (id) this.load(id);
    });

    // Keep unsaved new cards in the browser, so a refresh doesn't lose them
    effect(onCleanup => {
      const card = this.card();
      if (this.savedId() || this.id()) return;
      const timer = setTimeout(() => saveDraft(card), 400);
      onCleanup(() => clearTimeout(timer));
    });

    // Scale the full-size card down to fit the space available on screen
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      this.previewScale.set(Math.min(width / CARD_WIDTH, height / CARD_HEIGHT, 1));
    });
    effect(() => observer.observe(this.stage().nativeElement));
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeLeaving(event: BeforeUnloadEvent) {
    if (this.dirty() && this.savedId()) event.preventDefault();
  }

  // ----- Editing -----

  protected set<K extends keyof CardData>(key: K, value: CardData[K]) {
    this.card.update(card => ({ ...card, [key]: value }));
    this.dirty.set(true);
    this.status.set(null);
  }

  protected setFrame(frame: Frame) {
    const card = this.card();
    const changes: Partial<CardData> = { frame };
    if (!canBePendulum(frame)) changes.pendulum = false;
    if (['Slifer', 'Obelisk', 'Ra'].includes(frame)) {
      changes.attribute = 'Divine';
      changes.monsterType = 'Divine-Beast';
    }
    if (frame === 'Skill') changes.rarity = 'Skills';
    else if (card.frame === 'Skill' && card.rarity === 'Skills') changes.rarity = 'Ultra-Rare';
    this.card.set({ ...card, ...changes });
    this.dirty.set(true);
  }

  protected toggleAbility(ability: string) {
    const current = this.card().abilities;
    this.set('abilities', current.includes(ability) ? current.filter(a => a !== ability) : [...current, ability]);
  }

  protected toggleArrow(arrow: LinkArrow) {
    const current = this.card().linkArrows;
    this.set('linkArrows', current.includes(arrow) ? current.filter(a => a !== arrow) : [...current, arrow]);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected numberValue(event: Event, max: number): number {
    const n = Math.round(Number((event.target as HTMLInputElement).value));
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
  }

  // ----- Art -----

  protected onArtSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.useArt(file);
    input.value = ''; // allow picking the same file again
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) this.useArt(file);
  }

  private async useArt(file: File) {
    try {
      this.set('art', await resizeImage(file, MAX_ART_SIZE));
    } catch {
      this.status.set({ text: 'That file could not be opened as an image.', error: true });
    }
  }

  // ----- Saving and exporting -----

  private load(id: number) {
    this.busy.set('loading');
    this.cards.get(id).subscribe({
      next: saved => {
        this.card.set(saved.data);
        this.savedId.set(saved.id);
        this.dirty.set(false);
        this.busy.set(null);
      },
      error: err => {
        this.busy.set(null);
        this.status.set({ text: `Could not load that card: ${errorMessage(err)}`, error: true });
      },
    });
  }

  protected async save(asCopy = false) {
    if (!this.auth.loggedIn()) {
      this.router.navigate(['/login'], { queryParams: { next: '/' } });
      return;
    }
    this.busy.set('saving');
    try {
      // A half-size JPEG is plenty for the catalog and keeps the database small
      const image = await this.preview().toImage('jpeg', 0.5);
      const existingId = asCopy ? undefined : (this.savedId() ?? undefined);
      this.cards.save(this.card(), image, existingId).subscribe({
        next: id => {
          this.busy.set(null);
          this.dirty.set(false);
          this.status.set({ text: asCopy ? 'Saved as a new copy.' : 'Saved.' });
          if (id !== this.savedId()) {
            clearDraft();
            this.savedId.set(id);
            // Update the address bar without reloading the editor
            if (asCopy) this.location.go(`/edit/${id}`);
            else this.location.replaceState(`/edit/${id}`);
          }
        },
        error: err => {
          this.busy.set(null);
          this.status.set({ text: `Could not save: ${errorMessage(err)}`, error: true });
        },
      });
    } catch {
      this.busy.set(null);
      this.status.set({ text: 'Could not draw the card image.', error: true });
    }
  }

  protected async download() {
    this.busy.set('exporting');
    try {
      const url = await this.preview().toImage('png');
      const link = document.createElement('a');
      link.download = `${this.card().name.trim() || 'card'}.png`;
      link.href = url;
      link.click();
    } catch {
      this.status.set({ text: 'Could not create the image.', error: true });
    } finally {
      this.busy.set(null);
    }
  }

  protected startNew() {
    if (this.dirty() && !confirm('Start a new card? Unsaved changes will be lost.')) return;
    clearDraft();
    this.card.set(newCard());
    this.savedId.set(null);
    this.dirty.set(false);
    this.status.set(null);
    this.router.navigateByUrl('/');
  }
}

/** Shrinks an image file so its longest side is at most maxSize, returning a data URL. */
async function resizeImage(file: File, maxSize: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}

function loadDraft(): CardData | null {
  try {
    const json = localStorage.getItem(DRAFT_KEY);
    return json ? normalizeCard(JSON.parse(json)) : null;
  } catch {
    return null;
  }
}

function saveDraft(card: CardData) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(card));
  } catch {
    // Probably too large because of the art; keep the rest of the draft instead.
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...card, art: '' }));
    } catch {
      // Storage unavailable; drafts just won't survive a refresh.
    }
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
