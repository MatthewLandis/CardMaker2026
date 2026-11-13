import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../auth/auth.service';
import { CardSummary, CardsService } from '../card/cards.service';

@Component({
  selector: 'app-catalog',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header>
        <h1>My cards</h1>
        <a class="btn" routerLink="/">New card</a>
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      } @else if (cards() === null) {
        <p class="muted">Loading…</p>
      } @else if (cards()!.length === 0) {
        <div class="empty">
          <p>You haven't saved any cards yet.</p>
          <a class="btn" routerLink="/">Make your first card</a>
        </div>
      } @else {
        <ul class="grid">
          @for (card of cards(); track card.id) {
            <li>
              <a class="cardLink" [routerLink]="['/edit', card.id]" [title]="'Edit ' + card.name">
                <img [src]="card.image" [alt]="card.name" loading="lazy" />
              </a>
              <div class="meta">
                <span class="name">{{ card.name }}</span>
                <button class="btn danger small" (click)="remove(card)" [attr.aria-label]="'Delete ' + card.name">
                  Delete
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .page { width: 100%; max-width: 1200px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    h1 { font-size: 1.6rem; }
    .muted { color: var(--muted); }
    .empty { display: flex; flex-direction: column; align-items: flex-start; gap: 1rem; color: var(--muted); }
    .grid {
      list-style: none; margin: 0; padding: 0; display: grid; gap: 1.25rem;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    }
    li { display: flex; flex-direction: column; gap: 0.5rem; }
    .cardLink { display: block; border-radius: 8px; overflow: hidden; transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .cardLink:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); }
    img { display: block; width: 100%; aspect-ratio: 813 / 1185; object-fit: cover; background: var(--surface-2); }
    .meta { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .small { padding: 0.25rem 0.6rem; font-size: 0.85rem; }
  `,
})
export class Catalog {
  private readonly service = inject(CardsService);

  protected readonly cards = signal<CardSummary[] | null>(null);
  protected readonly error = signal('');

  constructor() {
    this.service.list().subscribe({
      next: cards => this.cards.set(cards),
      error: err => this.error.set(errorMessage(err)),
    });
  }

  protected remove(card: CardSummary) {
    if (!confirm(`Delete "${card.name}"? This can't be undone.`)) return;
    this.service.delete(card.id).subscribe({
      next: () => this.cards.update(list => list?.filter(c => c.id !== card.id) ?? null),
      error: err => alert(`Could not delete: ${errorMessage(err)}`),
    });
  }
}
