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
