type SectionEmptyStateProperties = {
  title: string;
  message: string;
};

const SectionEmptyState = ({ title, message }: SectionEmptyStateProperties) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold text-white">{title}</h3>
    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
      {message}
    </div>
  </div>
);

export default SectionEmptyState;
