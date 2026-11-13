import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CardData, normalizeCard } from './card.model';

export interface CardSummary {
  id: number;
  name: string;
  image: string;
  updatedAt: string;
}

export interface SavedCard extends CardSummary {
  data: CardData;
}

@Injectable({ providedIn: 'root' })
export class CardsService {
  private readonly http = inject(HttpClient);

  list(): Observable<CardSummary[]> {
    return this.http.get<CardSummary[]>('/api/cards');
  }

  get(id: number): Observable<SavedCard> {
    return this.http
      .get<SavedCard>(`/api/cards/${id}`)
      .pipe(map(card => ({ ...card, data: normalizeCard(card.data) })));
  }

  /** Creates a new card, or updates it when an id is given. Returns the card's id. */
  save(data: CardData, image: string, id?: number): Observable<number> {
    const body = { data, image };
    const request = id
      ? this.http.put<{ id: number }>(`/api/cards/${id}`, body)
      : this.http.post<{ id: number }>('/api/cards', body);
    return request.pipe(map(r => r.id));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/cards/${id}`);
  }
}
