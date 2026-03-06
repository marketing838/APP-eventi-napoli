
import React from 'react';
import { FieldDef } from '../types';

interface DynamicFieldsProps {
    fields: FieldDef[];
    values: Record<string, any>;
    errors: Record<string, string>;
    onChange: (key: string, value: any) => void;
    theme?: string;
}

const inputBase = (theme: string, hasError: boolean) =>
    `w-full px-4 py-4 bg-gray-50 border-2 ${hasError ? 'border-red-500' : 'border-gray-100'} rounded-2xl focus:ring-4 focus:ring-${theme}/10 focus:border-${theme} outline-none transition-all font-medium text-gray-700`;

const DynamicFields: React.FC<DynamicFieldsProps> = ({ fields, values, errors, onChange, theme = 'indigo-600' }) => {
    if (fields.length === 0) return null;

    return (
        <>
            {fields.map((field) => {
                const val = values[field.key] ?? '';
                const err = errors[field.key];
                const label = (
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block">
                        {field.label}
                        {field.required && <span className={`ml-1 text-${theme}`}>*</span>}
                    </label>
                );

                if (field.type === 'select') {
                    return (
                        <div key={field.key}>
                            {label}
                            <select
                                value={val}
                                onChange={(e) => onChange(field.key, e.target.value)}
                                className={inputBase(theme, !!err)}
                            >
                                <option value="">Seleziona...</option>
                                {(field.options ?? []).map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            {err && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{err}</p>}
                        </div>
                    );
                }

                if (field.type === 'textarea') {
                    return (
                        <div key={field.key}>
                            {label}
                            <textarea
                                value={val}
                                rows={3}
                                onChange={(e) => onChange(field.key, e.target.value)}
                                className={inputBase(theme, !!err)}
                            />
                            {err && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{err}</p>}
                        </div>
                    );
                }

                if (field.type === 'checkbox') {
                    return (
                        <div key={field.key}>
                            <label className={`flex items-center gap-3 cursor-pointer bg-gray-50 p-4 rounded-2xl border-2 ${err ? 'border-red-500' : 'border-gray-100'} transition-all`}>
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={!!val}
                                        onChange={(e) => onChange(field.key, e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-6 h-6 border-2 rounded-md transition-all flex items-center justify-center ${val ? `bg-${theme} border-${theme}` : 'bg-white border-gray-300'}`}>
                                        {val && (
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[11px] font-bold text-gray-700">{field.label}</span>
                            </label>
                            {err && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{err}</p>}
                        </div>
                    );
                }

                // text | email | tel | number | date (tutti input standard)
                return (
                    <div key={field.key}>
                        {label}
                        <input
                            type={field.type}
                            value={val}
                            onChange={(e) => onChange(field.key, e.target.value)}
                            className={inputBase(theme, !!err)}
                        />
                        {err && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{err}</p>}
                    </div>
                );
            })}
        </>
    );
};

export default DynamicFields;
