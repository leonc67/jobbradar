import { describe, expect, it } from 'vitest';
import { importFile } from '../src/backup.ts';
import type { StoreData } from '../src/store.ts';

const empty: StoreData = { version: 1, tracked: {}, manual: [], lastVisit: null };
const list = (items: object[]) => JSON.stringify(items);

describe('import', () => {
  it('oppdaterer status uten å slette notater eller gå bakover', () => {
    let { data } = importFile(list([{ company: 'Hydro', title: 'Summer Internship 2027', status: 'sendt', note: 'Søkte tre roller' }]), empty, []);
    ({ data } = importFile(list([{ company: 'Hydro', title: 'Summer Internship 2027', status: 'avslag', note: 'Avslag 29. okt' }]), data, []));
    const [t] = Object.values(data.tracked);
    expect(t.status).toBe('avslag');
    expect(t.note).toBe('Søkte tre roller\nAvslag 29. okt');
    expect(data.manual).toHaveLength(1);

    ({ data } = importFile(list([{ company: 'Hydro', title: 'Summer Internship 2027', status: 'sendt', note: 'Avslag 29. okt' }]), data, []));
    expect(Object.values(data.tracked)[0]).toMatchObject({ status: 'avslag', note: 'Søkte tre roller\nAvslag 29. okt' });
  });
});
