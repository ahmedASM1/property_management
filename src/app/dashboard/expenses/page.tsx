'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { saveAs } from 'file-saver';
import Link from 'next/link';

const categories = [
  'Utilities',
  'Rent',
  'Office Supplies',
  'Maintenance',
  'Salary',
  'Other',
];

interface Expense {
  id: string;
  amount: number;
  description: string;
  category?: string;
  type: 'expense' | 'income';
  receiptUrls: string[];
  createdAt: Date;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A020F0', '#FF4444', '#8884d8'];

function getCategoryData(expenses: Expense[]) {
  const map: Record<string, number> = {};
  expenses.filter(e => e.type === 'expense').forEach(e => {
    map[e.category || 'Other'] = (map[e.category || 'Other'] || 0) + e.amount;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function getMonthlyData(expenses: Expense[]) {
  const map: Record<string, { expense: number; income: number }> = {};
  expenses.forEach(e => {
    const month = dayjs(e.createdAt).format('YYYY-MM');
    if (!map[month]) map[month] = { expense: 0, income: 0 };
    map[month][e.type] += e.amount;
  });
  return Object.entries(map).map(([month, v]) => ({ month, ...v }));
}

function getBalanceData(expenses: Expense[]) {
  const sorted = [...expenses].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let balance = 0;
  return sorted.map(e => {
    balance += e.type === 'income' ? e.amount : -e.amount;
    return { date: dayjs(e.createdAt).format('YYYY-MM-DD'), balance };
  });
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [receipts, setReceipts] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [exportMonth, setExportMonth] = useState('all');
  const [exportYear, setExportYear] = useState('all');

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    const snapshot = await getDocs(collection(db, 'expenses'));
    setExpenses(snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        amount: data.amount,
        description: data.description,
        category: data.category,
        type: data.type || 'expense',
        receiptUrls: data.receiptUrls || [],
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      };
    }));
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!amount || !description) {
      setError('Amount and description are required.');
      return;
    }
    setUploading(true);
    let receiptUrls: string[] = [];
    for (const file of receipts) {
      const storageRef = ref(storage, `expenses/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      receiptUrls.push(url);
    }
    await addDoc(collection(db, 'expenses'), {
      amount: Number(amount),
      description,
      category,
      type,
      receiptUrls,
      createdAt: serverTimestamp(),
    });
    setAmount('');
    setDescription('');
    setCategory('Other');
    setType('expense');
    setReceipts([]);
    setUploading(false);
    fetchExpenses();
  }

  const totalExpenses = expenses.filter(e => e.type === 'expense').reduce((sum, exp) => sum + exp.amount, 0);
  const totalIncome = expenses.filter(e => e.type === 'income').reduce((sum, exp) => sum + exp.amount, 0);
  const balance = totalIncome - totalExpenses;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setReceipts(Array.from(e.target.files));
    }
  }

  // Filtering and search logic
  const filtered = expenses.filter(exp => {
    if (filterCategory !== 'All' && exp.category !== filterCategory) return false;
    if (filterType !== 'all' && exp.type !== filterType) return false;
    if (search && !exp.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (startDate && dayjs(exp.createdAt).isBefore(dayjs(startDate), 'day')) return false;
    if (endDate && dayjs(exp.createdAt).isAfter(dayjs(endDate), 'day')) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  function formatDate(date: Date) {
    return dayjs(date).format('YYYY-MM-DD');
  }

  async function handleDownloadPDF(exp: Expense) {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(18);
    doc.text('Expense/Income Receipt', 105, y, { align: 'center' });
    y += 12;
    doc.setFontSize(12);
    doc.text(`Platform: Green Bridge Admin`, 14, y); y += 8;
    doc.text(`Date: ${formatDate(exp.createdAt)}`, 14, y); y += 8;
    doc.text(`Type: ${exp.type.charAt(0).toUpperCase() + exp.type.slice(1)}`, 14, y); y += 8;
    doc.text(`Category: ${exp.category || '-'}`, 14, y); y += 8;
    doc.text(`Amount: RM${exp.amount.toFixed(2)}`, 14, y); y += 8;
    doc.text(`Description: ${exp.description}`, 14, y); y += 12;
    doc.setFontSize(14);
    doc.text('Receipts:', 14, y); y += 8;
    if (exp.receiptUrls && exp.receiptUrls.length > 0) {
      for (let i = 0; i < exp.receiptUrls.length; i++) {
        const url = exp.receiptUrls[i];
        if (url.match(/\.(jpg|jpeg|png)$/i)) {
          // Fetch image and add to PDF
          try {
            const imgData = await fetch(url).then(r => r.blob()).then(blob => new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            }));
            doc.addImage(imgData, 'JPEG', 14, y, 40, 40);
            y += 45;
          } catch {
            doc.text(`[Image could not be loaded: ${url}]`, 14, y); y += 8;
          }
        } else {
          doc.textWithLink(`PDF Receipt ${i + 1}`, 14, y, { url });
          y += 8;
        }
      }
    } else {
      doc.text('No receipt uploaded.', 14, y); y += 8;
    }
    doc.save(`Receipt_${exp.type}_${formatDate(exp.createdAt)}.pdf`);
  }

  // Chart data
  const categoryData = getCategoryData(expenses);
  const monthlyData = getMonthlyData(expenses);
  const balanceData = getBalanceData(expenses);

  // Helper to filter by export period
  function filterByExportPeriod(exp: Expense) {
    const m = dayjs(exp.createdAt).format('MM');
    const y = dayjs(exp.createdAt).format('YYYY');
    return (exportMonth === 'all' || m === exportMonth) && (exportYear === 'all' || y === exportYear);
  }
  const exportData = expenses.filter(filterByExportPeriod);

  // Helper to get unique years in data
  const years = Array.from(new Set(expenses.map(e => dayjs(e.createdAt).format('YYYY'))));

  async function handleExportPDF() {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text('Expense/Income Summary Report', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(12);
    doc.text(`Period: ${exportMonth === 'all' ? 'All' : exportMonth}/${exportYear === 'all' ? 'All' : exportYear}`, 14, y); y += 8;
    doc.text(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm')}`, 14, y); y += 10;
    // Table header
    doc.setFontSize(11);
    doc.text('Date', 14, y); doc.text('Type', 40, y); doc.text('Category', 65, y); doc.text('Amount', 110, y); doc.text('Description', 150, y); y += 7;
    doc.setLineWidth(0.1); doc.line(14, y, 200, y); y += 2;
    exportData.forEach(exp => {
      doc.text(dayjs(exp.createdAt).format('YYYY-MM-DD'), 14, y);
      doc.text(exp.type, 40, y);
      doc.text(exp.category || '-', 65, y);
      doc.text(`RM${exp.amount.toFixed(2)}`, 110, y);
      doc.text(exp.description.length > 30 ? exp.description.slice(0, 30) + '...' : exp.description, 150, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 6;
    // Group by category
    const catMap: Record<string, number> = {};
    exportData.forEach(e => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + e.amount; });
    doc.setFontSize(12);
    doc.text('Totals by Category:', 14, y); y += 7;
    Object.entries(catMap).forEach(([cat, amt]) => {
      doc.text(`${cat}: RM${amt.toFixed(2)}`, 20, y); y += 6;
    });
    y += 4;
    // Income vs Expense
    const totalExp = exportData.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
    const totalInc = exportData.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
    doc.text(`Total Expenses: RM${totalExp.toFixed(2)}`, 14, y); y += 6;
    doc.text(`Total Income: RM${totalInc.toFixed(2)}`, 14, y); y += 6;
    doc.text(`Balance: RM${(totalInc - totalExp).toFixed(2)}`, 14, y); y += 6;
    doc.save(`Summary_${exportMonth}_${exportYear}.pdf`);
  }

  function handleExportCSV() {
    let csv = 'Date,Type,Category,Amount,Description\n';
    exportData.forEach(exp => {
      csv += `${dayjs(exp.createdAt).format('YYYY-MM-DD')},${exp.type},${exp.category || '-'},${exp.amount.toFixed(2)},"${exp.description.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, `Summary_${exportMonth}_${exportYear}.csv`);
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-2 sm:px-0">
      <div className="mb-4 flex justify-start">
        <Link href="/dashboard">
          <span className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium">&larr; Back to Dashboard</span>
        </Link>
      </div>
      <h2 className="text-2xl font-bold mb-6 text-center">Expenses & Bills</h2>
      {/* Export Section */}
      <div className="mb-6 flex flex-col sm:flex-row gap-2 items-center bg-white p-4 rounded shadow">
        <select className="border rounded px-3 py-2 w-full sm:w-auto" value={exportMonth} onChange={e => setExportMonth(e.target.value)}>
          <option value="all">All Months</option>
          {[...Array(12)].map((_, i) => <option key={i+1} value={String(i+1).padStart(2, '0')}>{String(i+1).padStart(2, '0')}</option>)}
        </select>
        <select className="border rounded px-3 py-2 w-full sm:w-auto" value={exportYear} onChange={e => setExportYear(e.target.value)}>
          <option value="all">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 w-full sm:w-auto" onClick={handleExportPDF}>Export PDF</button>
        <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full sm:w-auto" onClick={handleExportCSV}>Export CSV</button>
      </div>
      {/* Analytics Dashboard */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Spending by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {categoryData.map((entry, idx) => <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Monthly Expenses vs Income</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Legend />
              <RechartsTooltip />
              <Bar dataKey="expense" fill="#FF4444" name="Expenses" />
              <Bar dataKey="income" fill="#00C49F" name="Income" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-4 rounded shadow md:col-span-2">
          <h3 className="font-semibold mb-2">Cumulative Balance Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={balanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <CartesianGrid strokeDasharray="3 3" />
              <Legend />
              <RechartsTooltip />
              <Line type="monotone" dataKey="balance" stroke="#0088FE" name="Balance" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Sticky summary */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 justify-between items-center bg-white p-4 rounded shadow sticky top-0 z-10">
        <div>Total Expenses: <span className="text-red-700 font-semibold">RM{totalExpenses.toFixed(2)}</span></div>
        <div>Total Income: <span className="text-green-700 font-semibold">RM{totalIncome.toFixed(2)}</span></div>
        <div>Balance: <span className="text-blue-700 font-semibold">RM{balance.toFixed(2)}</span></div>
      </div>
      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center bg-white p-4 rounded shadow">
        <input
          type="text"
          placeholder="Search description..."
          className="border rounded px-3 py-2 w-full sm:w-1/3"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="border rounded px-3 py-2 w-full sm:w-1/4"
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
        >
          <option value="All">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-2 w-full sm:w-1/4"
          value={filterType}
          onChange={e => { setFilterType(e.target.value as any); setPage(1); }}
        >
          <option value="all">All Types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input
          type="date"
          className="border rounded px-3 py-2 w-full sm:w-1/4"
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(1); }}
        />
        <input
          type="date"
          className="border rounded px-3 py-2 w-full sm:w-1/4"
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(1); }}
        />
      </div>
      <form onSubmit={handleAddExpense} className="mb-6 flex flex-col gap-2 bg-white p-4 rounded shadow">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount (RM)"
            className="border rounded px-3 py-2 w-full sm:w-1/4"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Description (e.g. Water bill, repairs, etc.)"
            className="border rounded px-3 py-2 w-full sm:w-2/4"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
          <select
            className="border rounded px-3 py-2 w-full sm:w-1/4"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center mt-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="expense"
              checked={type === 'expense'}
              onChange={() => setType('expense')}
            />
            <span>Expense</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="income"
              checked={type === 'income'}
              onChange={() => setType('income')}
            />
            <span>Income</span>
          </label>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center mt-2">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            multiple
            onChange={handleFileChange}
            className="w-full sm:w-auto"
          />
          {receipts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {receipts.map((file, idx) => file.type.startsWith('image/') ? (
                <img
                  key={idx}
                  src={URL.createObjectURL(file)}
                  alt="preview"
                  className="w-12 h-12 object-cover rounded border"
                />
              ) : (
                <span key={idx} className="text-xs text-gray-600 border rounded px-2 py-1 bg-gray-100">{file.name}</span>
              ))}
            </div>
          )}
        </div>
        {error && <div className="text-red-600 text-sm mt-1">{error}</div>}
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mt-2" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Add Entry'}
        </button>
      </form>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow text-sm md:text-base">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Date</th>
              <th className="py-2 px-4 border-b">Type</th>
              <th className="py-2 px-4 border-b">Category</th>
              <th className="py-2 px-4 border-b">Amount (RM)</th>
              <th className="py-2 px-4 border-b">Description</th>
              <th className="py-2 px-4 border-b">Receipts</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(exp => (
              <tr key={exp.id} className="border-b last:border-b-0">
                <td className="py-2 px-4">{exp.createdAt.toLocaleDateString()}</td>
                <td className="py-2 px-4 capitalize">{exp.type}</td>
                <td className="py-2 px-4">{exp.category || '-'}</td>
                <td className={`py-2 px-4 ${exp.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>{exp.amount.toFixed(2)}</td>
                <td className="py-2 px-4">{exp.description}</td>
                <td className="py-2 px-4">
                  {exp.receiptUrls && exp.receiptUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {exp.receiptUrls.map((url, idx) => url.match(/\.(jpg|jpeg|png)$/i) ? (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="receipt" className="w-10 h-10 object-cover rounded border" />
                        </a>
                      ) : (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">PDF</a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="py-2 px-4">
                  <button
                    className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                    onClick={() => handleDownloadPDF(exp)}
                  >
                    Download PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Next</button>
        </div>
      )}
      {/* Mobile cards */}
      <div className="block md:hidden mt-6 space-y-4">
        {paginated.map(exp => (
          <div key={exp.id} className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="text-xs text-gray-500">{exp.createdAt.toLocaleDateString()}</div>
            <div className="font-semibold {exp.type === 'income' ? 'text-green-700' : 'text-red-700'}">RM{exp.amount.toFixed(2)}</div>
            <div className="text-xs">{exp.type} | {exp.category || '-'}</div>
            <div className="text-xs">{exp.description}</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {exp.receiptUrls && exp.receiptUrls.length > 0 ? (
                exp.receiptUrls.map((url, idx) => url.match(/\.(jpg|jpeg|png)$/i) ? (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="receipt" className="w-10 h-10 object-cover rounded border" />
                  </a>
                ) : (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">PDF</a>
                ))
              ) : <span className="text-gray-400">-</span>}
            </div>
            <button
              className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 mt-2 w-full"
              onClick={() => handleDownloadPDF(exp)}
            >
              Download PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 