export default function InputFields({ icon, label, type = "text", name, value, onChange, placeholder }) {
  return (
    <div className="mb-4">
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder || label}
          className={`w-full ${icon ? "pl-10" : "pl-4"} pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
        />
      </div>
    </div>
  );
}