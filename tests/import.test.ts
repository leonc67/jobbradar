import { describe, expect, it } from 'vitest';
import { importFile } from '../src/backup.ts';
import { migrate, type StoreData } from '../src/store.ts';

const empty: StoreData = { version: 2, tracked: {}, manual: [], lastVisit: null };
const list = (items: object[]) => JSON.stringify(items);

describe('import', () => {
  it('setter hake og kryss uten å slette notater eller fjerne noe', () => {
    let { data } = importFile(list([{ company: 'Hydro', title: 'Summer Internship 2027', status: 'sendt', note: 'Søkte tre roller' }]), empty, []);
    ({ data } = importFile(list([{ company: 'Hydro', title: 'Summer Internship 2027', status: 'avslag', note: 'Avslag 29. okt' }]), data, []));
    const [t] = Object.values(data.tracked);
    expect(t).toMatchObject({ sent: true, rejected: true, note: 'Søkte tre roller\nAvslag 29. okt' });
    expect(data.manual).toHaveLength(1);

    ({ data } = importFile(list([{ company: 'Hydro', title: 'Summer Internship 2027', sent: true }]), data, []));
    expect(Object.values(data.tracked)[0]).toMatchObject({ sent: true, rejected: true });
  });

  it('hopper over stillinger du ikke har søkt på', () => {
    const { data } = importFile(list([{ company: 'Monil', title: 'Summer Internship', status: 'droppet' }]), empty, []);
    expect(Object.keys(data.tracked)).toHaveLength(0);
  });

  it('gjør om gamle statuser til hake og kryss', () => {
    const job = { key: 'k', company: 'A', title: 'B' };
    const old = { version: 1, manual: [], lastVisit: null, tracked: {
      a: { status: 'avslag', note: '', updatedAt: '', job: { ...job, key: 'a' } },
      b: { status: 'intervju', note: '', updatedAt: '', job: { ...job, key: 'b' } },
      c: { status: 'interessert', note: '', updatedAt: '', job: { ...job, key: 'c' } },
    } };
    const data = migrate(old)!;
    expect(data.tracked.a).toMatchObject({ sent: true, rejected: true });
    expect(data.tracked.b).toMatchObject({ sent: true, rejected: false });
    expect(data.tracked.c).toBeUndefined();
  });
});
