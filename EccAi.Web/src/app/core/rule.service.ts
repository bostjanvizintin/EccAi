import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Alert, Rule, RuleInput } from './models';

@Injectable({ providedIn: 'root' })
export class RuleService {
  private readonly http = inject(HttpClient);

  list(): Observable<Rule[]> {
    return this.http.get<Rule[]>('/api/rules');
  }

  create(rule: RuleInput): Observable<Rule> {
    return this.http.post<Rule>('/api/rules', rule);
  }

  update(id: number, rule: RuleInput): Observable<Rule> {
    return this.http.put<Rule>(`/api/rules/${id}`, rule);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/rules/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly http = inject(HttpClient);

  list(acknowledged?: boolean): Observable<Alert[]> {
    let params = new HttpParams();
    if (acknowledged !== undefined) {
      params = params.set('acknowledged', acknowledged);
    }
    return this.http.get<Alert[]>('/api/alerts', { params });
  }

  acknowledge(id: number): Observable<void> {
    return this.http.post<void>(`/api/alerts/${id}/acknowledge`, {});
  }
}
