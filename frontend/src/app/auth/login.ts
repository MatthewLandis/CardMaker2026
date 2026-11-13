import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, errorMessage } from './auth.service';

@Component({
  selector: 'app-login',
  template: `
    <form class="box" (submit)="submit($event)">
      <h1>{{ mode() === 'login' ? 'Log in' : 'Create an account' }}</h1>
      <p class="muted">Save your cards and edit them any time.</p>

      <label>
        <span>Username</span>
        <input class="input" name="username" autocomplete="username" required
               [value]="username()" (input)="username.set(value($event))" />
      </label>
      <label>
        <span>Password</span>
        <input class="input" name="password" type="password" required
               [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
               [value]="password()" (input)="password.set(value($event))" />
        @if (mode() === 'register') {
          <small class="muted">At least 8 characters.</small>
        }
      </label>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      <button class="btn" type="submit" [disabled]="busy()">
        {{ busy() ? 'Please wait…' : mode() === 'login' ? 'Log in' : 'Create account' }}
      </button>
      <button class="link" type="button" (click)="switchMode()">
        {{ mode() === 'login' ? 'New here? Create an account' : 'Already have an account? Log in' }}
      </button>
    </form>
  `,
  styles: `
    :host { display: flex; justify-content: center; padding: 3rem 1rem; }
    .box {
      width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 1rem;
      padding: 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    }
    h1 { font-size: 1.5rem; }
    label { display: flex; flex-direction: column; gap: 0.35rem; }
    label span { font-weight: 600; font-size: 0.9rem; color: var(--muted); }
    .muted { color: var(--muted); }
    .link { background: none; border: 0; color: var(--accent-light); cursor: pointer; padding: 0.25rem; }
    .link:hover { text-decoration: underline; }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Where to go after logging in, from the ?next= query parameter. */
  readonly next = input<string>();

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected switchMode() {
    this.mode.update(m => (m === 'login' ? 'register' : 'login'));
    this.error.set('');
  }

  protected submit(event: Event) {
    event.preventDefault();
    const request = this.mode() === 'login'
      ? this.auth.login(this.username(), this.password())
      : this.auth.register(this.username(), this.password());

    this.busy.set(true);
    this.error.set('');
    request.subscribe({
      next: () => {
        // Only follow local paths, never another website
        const next = this.next();
        this.router.navigateByUrl(next?.startsWith('/') && !next.startsWith('//') ? next : '/cards');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
