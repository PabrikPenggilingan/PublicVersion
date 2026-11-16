import re

with open('src/pages/COAList.tsx', 'r', encoding='utf-8') as f:
    coal_content = f.read()

def resolve_coa(match):
    return '''                                      <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200">
                                          <div className="text-left sm:text-right">
                                              <div className="text-[10px] text-stone-600 mb-0.5">Saldo Buku Besar</div>
                                              <div className="text-sm font-black text-stone-900 font-mono">
                                                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(acc.balance || 0)}
                                              </div>
                                          </div>
                                          <div className="text-left sm:text-right sm:mr-2">
                                              <div className="text-[10px] text-stone-600 mb-0.5">Tipe (Sub)</div>
                                              <div className="text-xs font-semibold text-stone-800 bg-stone-200 px-2.5 py-1 rounded-lg border border-stone-300">{acc.account_type}</div>'''

coal_content = re.sub(r'<<<<<<< HEAD.*?=======(.*?)>>>>>>> origin/AkmalFinCenFE', resolve_coa, coal_content, flags=re.DOTALL)

with open('src/pages/COAList.tsx', 'w', encoding='utf-8') as f:
    f.write(coal_content)
print('Resolved COAList.tsx')

with open('src/pages/FinanceDashboard.tsx', 'r', encoding='utf-8') as f:
    fin_content = f.read()

def resolve_fin_1(match):
    return '''                  {/* 4. Recent Activity (Bug D4 Fix: inklusif PENDING + status badges) */}
                  <div className="bg-stone-200 border border-stone-300/60 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
                      <div className="flex justify-between items-center">
                          <div>
                              <h3 className="text-base font-bold text-stone-900 tracking-wide">Aktivitas Keuangan Terbaru</h3>
                              <p className="text-xs text-stone-600 mt-0.5">Transaksi jurnal terbaru termasuk yang masih berstatus pending</p>
                          </div>'''

def resolve_fin_2(match):
    return '''                      {recentActivities.length === 0 ? (
                          <div className="bg-stone-100/50 rounded-2xl p-8 border border-stone-200 text-center">
                              <p className="text-sm text-stone-600">Belum ada aktivitas jurnal keuangan tercatat.</p>
                          </div>
                      ) : (
                          <div className="divide-y divide-stone-300/40">
                              {recentActivities.slice(0, 10).map((tx: any) => {'''

def resolve_fin_3(match):
    return '''                                              <div className="flex items-center gap-2">
                                                  <p className="font-bold text-stone-900 leading-none">{tx.description || 'Transaksi Keuangan'}</p>
                                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                                      status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                      status === 'PENDING' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                                      'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                                  }`}>
                                                      {status}
                                                  </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                  {tx.reference_type && (
                                                      <span className="text-[11px] text-stone-600 font-mono bg-stone-100 px-2 py-0.5 rounded border border-stone-300/50">
                                                          {tx.reference_type}
                                                      </span>
                                                  )}
                                                  {tx.created_by_name && (
                                                      <span className="text-[11px] text-stone-500">
                                                          oleh <span className="text-stone-700 font-medium">{tx.created_by_name}</span>
                                                      </span>
                                                  )}
                                                  <span className="text-[11px] text-stone-500 font-medium">'''

def resolve_fin_4(match):
    return '''                                                  b.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                  b.status === 'ACTIVE' ? 'bg-sky-500/10 text-sky-600 border-sky-500/20' :
                                                  'bg-stone-300 text-stone-700 border-stone-400'
'''

parts = list(re.finditer(r'<<<<<<< HEAD.*?=======(.*?)>>>>>>> origin/AkmalFinCenFE', fin_content, flags=re.DOTALL))
if len(parts) == 4:
    fin_content = fin_content[:parts[0].start()] + resolve_fin_1(parts[0]) + \
                  fin_content[parts[0].end():parts[1].start()] + resolve_fin_2(parts[1]) + \
                  fin_content[parts[1].end():parts[2].start()] + resolve_fin_3(parts[2]) + \
                  fin_content[parts[2].end():parts[3].start()] + resolve_fin_4(parts[3]) + \
                  fin_content[parts[3].end():]
    
    with open('src/pages/FinanceDashboard.tsx', 'w', encoding='utf-8') as f:
        f.write(fin_content)
    print('Resolved FinanceDashboard.tsx')
else:
    print('Failed to resolve FinanceDashboard.tsx, found', len(parts), 'conflicts')

