import sys

with open('src/pages/DryingDetail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 6. Cards
content = content.replace('bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform', 'rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: "#3b82f633", color: "#1d4ed8" }}')
content = content.replace('bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform', 'rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: "#10b98133", color: "#047857" }}')
content = content.replace('bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform', 'rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: "#f59e0b33", color: "#b45309" }}')
content = content.replace('transition-all bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20', 'transition-all group-hover:scale-110" style={{ backgroundColor: "#6366f133", color: "#4338ca" }}')
content = content.replace('transition-all bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20', 'transition-all group-hover:scale-110" style={{ backgroundColor: "#f43f5e33", color: "#be123c" }}')

# 8. Data Mulai
content = content.replace('tracking-widest text-dark-200">Data Mulai', 'tracking-widest text-[#d97706]">Data Mulai')

# 9. Alur Pengeringan nodes
content = content.replace('mb-3 border-4 border-dark-900">\n<Package size={20} className="text-[#ffffff]" />', 'mb-3 border-4 border-[#bfdbfe]">\n<Package size={20} className="text-[#bfdbfe]" />')

start_session_old = "mb-3 border-4 border-dark-900 transition-all ${startSession ? 'bg-amber-500 shadow-amber-500/20' : 'bg-dark-700 text-dark-500'}\">\n<Zap size={20} className={startSession ? 'text-[#ffffff]' : 'text-dark-500'} />"
start_session_new = "mb-3 border-4 transition-all ${startSession ? 'bg-amber-500 shadow-amber-500/20 border-[#fde68a]' : 'bg-dark-700 text-dark-500 border-dark-700'}\">\n<Zap size={20} className={startSession ? 'text-[#fde68a]' : 'text-dark-500'} />"
content = content.replace(start_session_old, start_session_new)

end_session_old = "mb-3 border-4 border-dark-900 transition-all ${endSession ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-dark-700 text-dark-500'}\">\n<Check size={20} className={endSession ? 'text-[#ffffff]' : 'text-dark-500'} />"
end_session_new = "mb-3 border-4 transition-all ${endSession ? 'bg-emerald-500 shadow-emerald-500/20 border-[#a7f3d0]' : 'bg-dark-700 text-dark-500 border-dark-700'}\">\n<Check size={20} className={endSession ? 'text-[#a7f3d0]' : 'text-dark-500'} />"
content = content.replace(end_session_old, end_session_new)

with open('src/pages/DryingDetail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated DryingDetail')
