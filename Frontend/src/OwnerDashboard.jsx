// src/OwnerDashboard.jsx
import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { AuthContext } from './AuthContext';
import "./Home.css";

const bsMonths = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

const OwnerDashboard = () => {
  const { user, logout } = useContext(AuthContext);

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [history, setHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [unpaidSummary, setUnpaidSummary] = useState([]);
  const [availableYears, setAvailableYears] = useState([2080, 2081, 2082, 2083, 2084, 2085, 2086, 2087, 2088, 2089]);
  const [newYear, setNewYear] = useState("");
  const [showAddYear, setShowAddYear] = useState(false);
  const [multiMonths, setMultiMonths] = useState(1);
  const [internetRate, setInternetRate] = useState("");
  const [selectedInternetMonths, setSelectedInternetMonths] = useState(new Set());
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [showBulkPayment, setShowBulkPayment] = useState(false);
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState("");
  const [bulkPaymentResults, setBulkPaymentResults] = useState([]);
  const [surplusAction, setSurplusAction] = useState("deduct");
  const [surplusAmount, setSurplusAmount] = useState(0);
  const [qrUrl, setQrUrl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [form, setForm] = useState({
    id: null,
    month: "",
    year: "",
    rent: "",
    prevElectricity: "",
    currElectricity: "",
    electricityRate: "",
    water: "",
    internet: "no",
    waste: "",
    payment_status: "paid",
    paid_amount: "",
    remaining_amount: "",
  });

  // Auto-select logged-in owner
  useEffect(() => {
    if (user?.role === 'owner' && user?.id && !selectedUserId) {
      setSelectedUserId(user.id.toString());
    }
  }, [user, selectedUserId]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setHistory([]);
      setUnpaidSummary([]);
      resetForm();
      setIsEditing(false);
      setSelectedEntries(new Set());
      setQrUrl(null);
      return;
    }
    fetchHistory();
    fetchQR();
  }, [selectedUserId]);

  useEffect(() => {
    if (form.internet === "yes") {
      setSelectedInternetMonths(new Set());
    }
  }, [multiMonths, form.month, form.year]);

  useEffect(() => {
    if (!isEditing && history.length > 0 && selectedUserId) {
      const sortedHistory = [...history].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return bsMonths.indexOf(b.month) - bsMonths.indexOf(a.month);
      });
      const lastEntry = sortedHistory[0];
      setForm(prev => ({
        ...prev,
        prevElectricity: lastEntry.curr_unit.toString(),
        rent: lastEntry.rent.toString(),
        electricityRate: lastEntry.electricity_rate.toString(),
        water: lastEntry.water.toString(),
        waste: lastEntry.waste.toString(),
      }));
      setSelectedInternetMonths(new Set());
    }
  }, [history, isEditing, selectedUserId]);

  useEffect(() => {
    const monthlyRent = parseFloat(form.rent) || 0;
    const prevUnit = parseFloat(form.prevElectricity) || 0;
    const currUnit = parseFloat(form.currElectricity) || 0;
    const electricityRate = parseFloat(form.electricityRate) || 0;
    const water = parseFloat(form.water) || 0;
    const waste = parseFloat(form.waste) || 0;
    const internetMonthly = parseFloat(internetRate) || 0;
    const electricityUsage = Math.max(currUnit - prevUnit, 0);
    const electricityBill = electricityUsage * electricityRate;
    const recurringTotal = (monthlyRent + water + waste) * multiMonths;
    let internetTotal = 0;
    if (form.internet === "yes" && form.month && form.year) {
      const currentMonthIdx = bsMonths.indexOf(form.month);
      let internetCount = 0;
      for (let i = 0; i < multiMonths; i++) {
        const monthIdx = (currentMonthIdx + i) % 12;
        const monthName = bsMonths[monthIdx];
        if (selectedInternetMonths.has(monthName)) {
          internetCount++;
        }
      }
      internetTotal = internetMonthly * internetCount;
    }
    const baseTotal = recurringTotal + electricityBill + internetTotal;
    setTotal(baseTotal);
    if (form.payment_status === "paid") {
      setForm(prev => ({
        ...prev,
        paid_amount: baseTotal.toString(),
        remaining_amount: "0"
      }));
    } else if (form.payment_status === "unpaid") {
      setForm(prev => ({
        ...prev,
        paid_amount: "0",
        remaining_amount: baseTotal.toString()
      }));
    } else if (form.payment_status === "partially_paid") {
      const paidAmt = parseFloat(form.paid_amount) || 0;
      const remainingAmt = baseTotal - paidAmt;
      setForm(prev => ({
        ...prev,
        remaining_amount: remainingAmt > 0 ? remainingAmt.toString() : "0"
      }));
    }
  }, [
    form.rent,
    form.prevElectricity,
    form.currElectricity,
    form.electricityRate,
    form.water,
    form.waste,
    form.internet,
    internetRate,
    selectedInternetMonths,
    multiMonths,
    form.paid_amount,
    form.payment_status
  ]);

  useEffect(() => {
    if (user?.role === 'owner' && user.id) {
      fetchNotifications();
    }
  }, [user]);

  const getAvailableMonths = () => {
    if (!form.year) return [];
    const used = history
      .filter(h => h.year === parseInt(form.year))
      .map(h => h.month);
    if (isEditing) return bsMonths;
    return bsMonths.filter(m => !used.includes(m));
  };
  const availableMonths = getAvailableMonths();

  const getCalculationMonths = () => {
    if (!form.month) return [];
    const currentMonthIdx = bsMonths.indexOf(form.month);
    const months = [];
    for (let i = 0; i < multiMonths; i++) {
      const monthIdx = (currentMonthIdx + i) % 12;
      months.push(bsMonths[monthIdx]);
    }
    return months;
  };

const fetchUsers = async () => {
  try {
    if (user?.role === 'owner') {
      // Owner: Only show tenants linked to this owner
      const res = await axios.get(`http://localhost:5000/api/users?ownerId=${user.id}`);
      setUsers(res.data);
    } else {
      // Fallback: Show all users (for now)
      const res = await axios.get("http://localhost:5000/api/users");
      setUsers(res.data);
    }
  } catch (err) {
    console.error("Fetch users error:", err);
  }
};

  const fetchHistory = async () => {
    if (!selectedUserId) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/rents?userId=${selectedUserId}`);
      const sorted = res.data.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return bsMonths.indexOf(b.month) - bsMonths.indexOf(a.month);
      });
      setHistory(sorted);
      const unpaid = sorted
        .filter(e => e.payment_status !== "paid")
        .map(e => ({ month: e.month, year: e.year, amount: parseFloat(e.remaining_amount) || 0 }));
      setUnpaidSummary(unpaid);
    } catch (err) {
      console.error("Fetch history error:", err);
      alert("Failed to load rent history.");
    }
  };

const fetchQR = async () => {
  if (!user?.id) return;
  try {
    // Fetch owner's QR (user.id), not selectedUserId
    const res = await axios.get(`http://localhost:5000/api/qr/${user.id}`);
    setQrUrl(res.data.qr_image_url);
  } catch (err) {
    console.error("Fetch QR error:", err);
  }
};

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/notifications/${user.id}`);
      setNotifications(res.data);
    } catch (err) {
      console.error("Fetch notifications error:", err);
    }
  };

  const resetForm = () => {
    setForm({
      id: null,
      month: "",
      year: "",
      rent: "",
      prevElectricity: "",
      currElectricity: "",
      electricityRate: "",
      water: "",
      internet: "no",
      waste: "",
      payment_status: "paid",
      paid_amount: "",
      remaining_amount: "",
    });
    setMultiMonths(1);
    setInternetRate("");
    setSelectedInternetMonths(new Set());
  };

const handleQRUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64Data = reader.result.replace(/^image\/\w+;base64,/, "");
      // Save to OWNER's ID, not selectedUserId
      await axios.post(`http://localhost:5000/api/qr/${user.id}`, {
        imageBase64: reader.result
      });
      alert('QR uploaded!');
      fetchQR(); // Refresh
    } catch (err) {
      console.error("QR upload error:", err);
      alert('Upload failed');
    }
  };
  reader.readAsDataURL(file);
};

  const deleteNotification = async (id) => {
    if (!window.confirm("Delete this notification?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/notifications/${id}`);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      alert('Failed to delete notification.');
    }
  };

  const handleInternetMonthToggle = (monthName) => {
    const newSelected = new Set(selectedInternetMonths);
    if (newSelected.has(monthName)) {
      newSelected.delete(monthName);
    } else {
      newSelected.add(monthName);
    }
    setSelectedInternetMonths(newSelected);
  };

  const handleSelectAllInternetMonths = () => {
    const calculationMonths = getCalculationMonths();
    if (selectedInternetMonths.size === calculationMonths.length) {
      setSelectedInternetMonths(new Set());
    } else {
      setSelectedInternetMonths(new Set(calculationMonths));
    }
  };

  const handleUserChange = (e) => {
  const userId = e.target.value;
  if (userId && user?.role === 'owner') {
    // Ensure selected user is linked to this owner
    const selectedUser = users.find(u => u.id == userId);
    if (selectedUser && selectedUser.linked_owner_id !== user.id) {
      alert("You cannot manage this user.");
      return;
    }
  }
  setSelectedUserId(userId);
  setSelectedEntries(new Set());
  setIsEditing(false);
};



  const handleAddYear = () => {
    const year = parseInt(newYear);
    if (!year || year < 2070 || year > 2200) return alert("Invalid year.");
    if (availableYears.includes(year)) return alert("Year exists.");
    setAvailableYears(prev => [...prev, year].sort((a, b) => a - b));
    setNewYear("");
    setShowAddYear(false);
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Delete user and records?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/users/${id}`);
      if (selectedUserId === id.toString()) setSelectedUserId("");
      fetchUsers();
      alert("User deleted.");
    } catch (err) {
      alert("Delete failed.");
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "prevElectricity" && history.length > 0 && !isEditing) {
      return;
    }
    setForm(prev => {
      const newForm = { ...prev, [name]: value };
      if (name === "internet" && value === "no") {
        setInternetRate("");
        setSelectedInternetMonths(new Set());
      }
      return newForm;
    });
  };

  const handleCalculateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return alert("Select a user.");
    if (!form.month || !form.year) return alert("Select month and year.");
    if (parseFloat(form.currElectricity) < parseFloat(form.prevElectricity) && !isEditing) {
      if (!window.confirm("Current unit is less than previous unit. Continue?")) {
        return;
      }
    }
    const monthsToProcess = parseInt(multiMonths);
    const year = parseInt(form.year);
    const startIdx = bsMonths.indexOf(form.month);
    if (startIdx === -1) return alert("Invalid month.");
    const internetBillPerMonth = parseFloat(internetRate) || 0;
    if (form.internet === "yes") {
      if (internetBillPerMonth <= 0) return alert("Enter valid internet rate.");
      if (selectedInternetMonths.size === 0) return alert("Select at least one month for internet.");
    }
    try {
      let currentPrevUnit = parseFloat(form.prevElectricity);
      const entries = [];
      const totalElectricityUsage = parseFloat(form.currElectricity) - parseFloat(form.prevElectricity);
      const electricityRate = parseFloat(form.electricityRate);
      const electricityUsagePerMonth = monthsToProcess === 1 ? totalElectricityUsage : totalElectricityUsage / monthsToProcess;
      for (let i = 0; i < monthsToProcess; i++) {
        const monthIdx = (startIdx + i) % 12;
        let currentYear = year + Math.floor((startIdx + i) / 12);
        const month = bsMonths[monthIdx];
        const existing = history.find(h => h.month === month && h.year === currentYear);
        if (existing && !isEditing) return alert(`Entry for ${month} ${currentYear} already exists.`);
        let currentCurrUnit;
        if (monthsToProcess === 1) {
          currentCurrUnit = parseFloat(form.currElectricity);
        } else if (i === monthsToProcess - 1) {
          currentCurrUnit = parseFloat(form.currElectricity);
        } else {
          currentCurrUnit = currentPrevUnit + electricityUsagePerMonth;
        }
        const monthlyElectricityUsage = currentCurrUnit - currentPrevUnit;
        const monthlyElectricityBill = monthlyElectricityUsage * electricityRate;
        const monthlyRentCost = parseFloat(form.rent) + parseFloat(form.water) + parseFloat(form.waste);
        const currentMonthName = bsMonths[(startIdx + i) % 12];
        const hasInternet = form.internet === "yes" && selectedInternetMonths.has(currentMonthName);
        const internetBill = hasInternet ? internetBillPerMonth : 0;
        const finalTotal = monthlyRentCost + monthlyElectricityBill + internetBill;
        let paidAmt = 0, remainAmt = finalTotal;
        if (form.payment_status === "paid") {
          paidAmt = finalTotal;
          remainAmt = 0;
        } else if (form.payment_status === "unpaid") {
          paidAmt = 0;
          remainAmt = finalTotal;
        } else if (form.payment_status === "partially_paid") {
          paidAmt = i === 0 ? Math.min(parseFloat(form.paid_amount) || 0, finalTotal) : 0;
          remainAmt = finalTotal - paidAmt;
        }
        entries.push({
          user_id: selectedUserId,
          month,
          year: currentYear,
          rent: parseFloat(form.rent),
          prev_unit: Math.round(currentPrevUnit * 100) / 100,
          curr_unit: Math.round(currentCurrUnit * 100) / 100,
          electricity_rate: electricityRate,
          water: parseFloat(form.water),
          internet: hasInternet,
          internet_amount: internetBill,
          waste: parseFloat(form.waste),
          total: Math.round(finalTotal * 100) / 100,
          payment_status: paidAmt === finalTotal ? "paid" : paidAmt > 0 ? "partially_paid" : "unpaid",
          paid_amount: Math.round(paidAmt * 100) / 100,
          remaining_amount: Math.round(remainAmt * 100) / 100,
        });
        currentPrevUnit = currentCurrUnit;
      }
      if (isEditing) {
        await axios.put(`http://localhost:5000/api/rents/${form.id}`, entries[0]);
      } else {
        for (const entry of entries) {
          await axios.post("http://localhost:5000/api/rents", entry);
        }
      }
      alert(`${entries.length} record(s) saved successfully.`);
      await fetchHistory();
      resetForm();
      setIsEditing(false);
    } catch (err) {
      console.error("Save error:", err);
      alert("Save failed.");
    }
  };

  const handleEdit = (entry) => {
    setForm({
      id: entry.id,
      month: entry.month,
      year: entry.year.toString(),
      rent: entry.rent.toString(),
      prevElectricity: entry.prev_unit.toString(),
      currElectricity: entry.curr_unit.toString(),
      electricityRate: entry.electricity_rate.toString(),
      water: entry.water.toString(),
      internet: entry.internet ? "yes" : "no",
      waste: entry.waste.toString(),
      payment_status: entry.payment_status,
      paid_amount: entry.paid_amount.toString(),
      remaining_amount: entry.remaining_amount.toString(),
    });
    setInternetRate(entry.internet_amount ? entry.internet_amount.toString() : "");
    setSelectedInternetMonths(new Set());
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    resetForm();
    if (history.length > 0) {
      const sortedHistory = [...history].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return bsMonths.indexOf(b.month) - bsMonths.indexOf(a.month);
      });
      const lastEntry = sortedHistory[0];
      setForm(prev => ({
        ...prev,
        prevElectricity: lastEntry.curr_unit.toString(),
        rent: lastEntry.rent.toString(),
        electricityRate: lastEntry.electricity_rate.toString(),
        water: lastEntry.water.toString(),
        waste: lastEntry.waste.toString(),
      }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/rents/${id}`);
      alert("Entry deleted.");
      await fetchHistory();
    } catch (err) {
      alert("Delete failed.");
    }
  };

  const handleSelectEntry = (id) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedEntries(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedEntries.size === 0) return alert("No entries selected.");
    if (!window.confirm(`Delete ${selectedEntries.size} records?`)) return;
    try {
      for (const id of selectedEntries) {
        await axios.delete(`http://localhost:5000/api/rents/${id}`);
      }
      alert(`${selectedEntries.size} records deleted.`);
      await fetchHistory();
      setSelectedEntries(new Set());
    } catch (err) {
      alert("Failed to delete some records.");
    }
  };

  const calculateBulkPayment = (amount) => {
    const unpaidBills = history
      .filter(e => e.payment_status !== "paid")
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return bsMonths.indexOf(a.month) - bsMonths.indexOf(b.month);
      });
    let remainingAmount = parseFloat(amount) || 0;
    const results = [];
    let surplus = 0;
    for (const bill of unpaidBills) {
      if (remainingAmount <= 0) break;
      const billRemaining = parseFloat(bill.remaining_amount);
      const paymentApplied = Math.min(remainingAmount, billRemaining);
      results.push({
        id: bill.id,
        month: bill.month,
        year: bill.year,
        previousRemaining: billRemaining,
        paymentApplied,
        newRemaining: billRemaining - paymentApplied,
        newStatus: (billRemaining - paymentApplied) <= 0 ? "paid" : "partially_paid"
      });
      remainingAmount -= paymentApplied;
    }
    surplus = remainingAmount > 0 ? remainingAmount : 0;
    setSurplusAmount(surplus);
    return { results, surplus };
  };

  const handleBulkPaymentChange = (e) => {
    const amount = e.target.value;
    setBulkPaymentAmount(amount);
    if (amount) {
      const { results, surplus } = calculateBulkPayment(amount);
      setBulkPaymentResults(results);
    } else {
      setBulkPaymentResults([]);
    }
  };

  const handleSaveBulkPayment = async () => {
    if (!bulkPaymentAmount || bulkPaymentResults.length === 0) return;
    try {
      for (const result of bulkPaymentResults) {
        const bill = history.find(b => b.id === result.id);
        if (!bill) continue;
        await axios.put(`http://localhost:5000/api/rents/${result.id}`, {
          ...bill,
          paid_amount: parseFloat(bill.paid_amount) + result.paymentApplied,
          remaining_amount: result.newRemaining,
          payment_status: result.newStatus
        });
      }
      if (surplusAmount > 0 && surplusAction === "deduct") {
        const sortedHistory = [...history].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return bsMonths.indexOf(a.month) - bsMonths.indexOf(b.month);
        });
        const lastEntry = sortedHistory[sortedHistory.length - 1];
        let nextMonthIdx = (bsMonths.indexOf(lastEntry.month) + 1) % 12;
        let nextYear = lastEntry.year;
        if (nextMonthIdx === 0) nextYear++;
        const nextMonthBill = history.find(
          b => b.month === bsMonths[nextMonthIdx] && b.year === nextYear
        );
        if (nextMonthBill) {
          await axios.put(`http://localhost:5000/api/rents/${nextMonthBill.id}`, {
            ...nextMonthBill,
            paid_amount: parseFloat(nextMonthBill.paid_amount) + surplusAmount,
            remaining_amount: Math.max(0, parseFloat(nextMonthBill.remaining_amount) - surplusAmount),
            payment_status: parseFloat(nextMonthBill.remaining_amount) - surplusAmount <= 0 ? "paid" : "partially_paid",
            is_surplus_adjusted: true
          });
        } else {
          const newEntry = {
            user_id: selectedUserId,
            month: bsMonths[nextMonthIdx],
            year: nextYear,
            rent: parseFloat(form.rent) || 0,
            prev_unit: lastEntry.curr_unit,
            curr_unit: lastEntry.curr_unit,
            electricity_rate: parseFloat(form.electricityRate) || 0,
            water: parseFloat(form.water) || 0,
            internet: false,
            internet_amount: 0,
            waste: parseFloat(form.waste) || 0,
            total: parseFloat(form.rent) + parseFloat(form.water) + parseFloat(form.waste),
            payment_status: "partially_paid",
            paid_amount: surplusAmount,
            remaining_amount: (parseFloat(form.rent) + parseFloat(form.water) + parseFloat(form.waste)) - surplusAmount,
            is_surplus_adjusted: true
          };
          await axios.post("http://localhost:5000/api/rents", newEntry);
        }
      }
      alert("Bulk payment applied!");
      setBulkPaymentAmount("");
      setBulkPaymentResults([]);
      setShowBulkPayment(false);
      await fetchHistory();
    } catch (err) {
      console.error("Bulk payment error:", err);
      alert("Failed to apply bulk payment.");
    }
  };

  const handleDownloadPDF = (entry) => {
    const user = users.find(u => u.id == entry.user_id);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Rent of ${user?.name || 'Unknown User'} - ${entry.month} ${entry.year}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Previous Unit: ${entry.prev_unit} units`, 14, 30);
    doc.text(`Current Unit: ${entry.curr_unit} units`, 14, 38);
    doc.text(`Units Used: ${(entry.curr_unit - entry.prev_unit).toFixed(1)} units`, 14, 46);
    doc.text(`Electricity Rate: Rs. ${entry.electricity_rate.toFixed(2)}/unit`, 14, 54);
    doc.text(`Electricity Bill: Rs. ${((entry.curr_unit - entry.prev_unit) * entry.electricity_rate).toFixed(2)}`, 14, 62);
    doc.text(`Monthly Rent: Rs. ${entry.rent.toFixed(2)}`, 14, 70);
    doc.text(`Water Bill: Rs. ${entry.water.toFixed(2)}`, 14, 78);
    doc.text(`Waste Fee: Rs. ${entry.waste.toFixed(2)}`, 14, 86);
    let yPos = 94;
    if (entry.internet && entry.internet_amount > 0) {
      doc.text(`Internet: Rs. ${entry.internet_amount.toFixed(2)}`, 14, yPos);
      yPos += 8;
    }
    if (entry.is_surplus_adjusted) {
      doc.text(`Surplus Adjustment: Rs. ${entry.paid_amount.toFixed(2)}`, 14, yPos);
      yPos += 8;
      doc.text(`Note: This payment includes surplus from previous payment`, 14, yPos);
      yPos += 8;
    }
    doc.text(`Payment Status: ${entry.payment_status}`, 14, yPos);
    yPos += 8;
    doc.text(`Paid Amount: Rs. ${entry.paid_amount.toFixed(2)}`, 14, yPos);
    yPos += 8;
    doc.text(`Remaining: Rs. ${entry.remaining_amount.toFixed(2)}`, 14, yPos);
    yPos += 8;
    doc.text(`Total: Rs. ${entry.total.toFixed(2)}`, 14, yPos);
    doc.save(`rent_${user?.name || 'user'}_${entry.month}_${entry.year}.pdf`);
  };

  const handleDownloadCombinedPDF = () => {
    if (selectedEntries.size === 0) return alert("No entries selected.");
    const selectedData = history.filter(entry => selectedEntries.has(entry.id))
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return bsMonths.indexOf(a.month) - bsMonths.indexOf(b.month);
      });
    const user = users.find(u => u.id == selectedUserId);
    const startMonth = selectedData[0]?.month;
    const startYear = selectedData[0]?.year;
    const endMonth = selectedData[selectedData.length-1]?.month;
    const endYear = selectedData[selectedData.length-1]?.year;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Rent of ${user?.name || 'Unknown User'} from ${startMonth} to ${endMonth} ${startYear === endYear ? startYear : `${startYear}-${endYear}`}`, 14, 20);
    doc.setFontSize(12);
    let y = 30;
    let grandTotal = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    selectedData.forEach((entry, index) => {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.text(`${entry.month} ${entry.year}`, 14, y);
      doc.setFontSize(10);
      y += 8;
      doc.text(`Previous Unit: ${entry.prev_unit} units`, 20, y);
      y += 6;
      doc.text(`Current Unit: ${entry.curr_unit} units`, 20, y);
      y += 6;
      doc.text(`Units Used: ${(entry.curr_unit - entry.prev_unit).toFixed(1)} units`, 20, y);
      y += 6;
      doc.text(`Electricity Rate: Rs. ${entry.electricity_rate.toFixed(2)}/unit`, 20, y);
      y += 6;
      doc.text(`Electricity Bill: Rs. ${((entry.curr_unit - entry.prev_unit) * entry.electricity_rate).toFixed(2)}`, 20, y);
      y += 6;
      doc.text(`Rent: Rs. ${entry.rent.toFixed(2)}`, 20, y);
      y += 6;
      doc.text(`Water: Rs. ${entry.water.toFixed(2)}`, 20, y);
      y += 6;
      doc.text(`Waste: Rs. ${entry.waste.toFixed(2)}`, 20, y);
      y += 6;
      if (entry.internet && entry.internet_amount > 0) {
        doc.text(`Internet: Rs. ${entry.internet_amount.toFixed(2)}`, 20, y);
        y += 6;
      }
      if (entry.is_surplus_adjusted) {
        doc.text(`Surplus Adjustment: Rs. ${entry.paid_amount.toFixed(2)}`, 20, y);
        y += 6;
      }
      doc.text(`Subtotal: Rs. ${entry.total.toFixed(2)}`, 20, y);
      y += 6;
      doc.text(`Status: ${entry.payment_status} | Paid: Rs. ${entry.paid_amount.toFixed(2)} | Remaining: Rs. ${entry.remaining_amount.toFixed(2)}`, 20, y);
      y += 12;
      grandTotal += entry.total;
      totalPaid += entry.paid_amount;
      totalRemaining += entry.remaining_amount;
    });
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    y += 10;
    doc.setFontSize(14);
    doc.text(`SUMMARY`, 14, y);
    y += 10;
    doc.setFontSize(12);
    doc.text(`Grand Total: Rs. ${grandTotal.toFixed(2)}`, 14, y);
    y += 8;
    doc.text(`Total Paid: Rs. ${totalPaid.toFixed(2)}`, 14, y);
    y += 8;
    doc.text(`Total Remaining: Rs. ${totalRemaining.toFixed(2)}`, 14, y);
    if (surplusAmount > 0) {
      y += 10;
      doc.text(`Surplus Amount: Rs. ${surplusAmount.toFixed(2)}`, 14, y);
      y += 8;
      doc.text(`Surplus Action: ${surplusAction === 'deduct' ? 'Deducted from next month' : 'Returned to tenant'}`, 14, y);
    }
    doc.save(`rent_${user?.name || 'user'}_${startMonth}_${startYear}_to_${endMonth}_${endYear}.pdf`);
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="main-title">{user.name} Dashboard</h1>
        <button onClick={logout} className="btn-danger" style={{ padding: '8px 16px' }}>
          Logout
        </button>
      </div>

      {/* Owner Code Display */}
      {user?.role === 'owner' && user?.owner_code && (
        <div className="alert" style={{ backgroundColor: '#e3f2fd', borderColor: '#2196f3', color: '#0d47a1' }}>
          <strong>Your Owner Code:</strong> <code style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{user.owner_code}</code>
          <br />
          <small>Share this code with tenants so they can register under you.</small>
        </div>
      )}

      {/* Notifications Button */}
      {user?.role === 'owner' && (
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <button onClick={() => setShowNotifications(true)} className="btn-primary">
            Notifications ({notifications.length})
          </button>
        </div>
      )}

    

      <div className="user-section">
        <select value={selectedUserId} onChange={handleUserChange} required>
          <option value="">-- Select User --</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        {selectedUserId && (
          <button onClick={() => handleDeleteUser(selectedUserId)} className="btn-danger">
            Delete User
          </button>
        )}
      </div>

      {/* QR Upload Section */}
 {user?.role === 'owner' && selectedUserId === user.id.toString() && (
  <div className="qr-section" style={{ marginBottom: '20px' }}>
    <h3>Payment QR Code (for all tenants)</h3>
    <input
      type="file"
      accept="image/*"
      onChange={handleQRUpload}
      style={{ marginBottom: '10px' }}
    />
    {qrUrl && <img src={qrUrl} alt="Payment QR" style={{ width: '200px', marginTop: '10px' }} />}
  </div>
)}

      <div className="year-section">
        {!showAddYear ? (
          <button onClick={() => setShowAddYear(true)}>Add Year</button>
        ) : (
          <div>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              placeholder="Year"
            />
            <button onClick={handleAddYear}>Add</button>
            <button onClick={() => { setShowAddYear(false); setNewYear(""); }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {unpaidSummary.length > 0 && (
        <div className="alert">
          <strong>Unpaid: </strong>
          {unpaidSummary.map((u, i) => (
            <span key={i}>
              {u.month} {u.year}: Rs.{u.amount.toFixed(2)}{i < unpaidSummary.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}

      {unpaidSummary.length > 0 && (
        <div className="bulk-payment-section">
          {!showBulkPayment ? (
            <button onClick={() => setShowBulkPayment(true)}>
              Apply Bulk Payment
            </button>
          ) : (
            <div className="bulk-payment-form">
              <h3>Bulk Payment</h3>
              <div className="form-row">
                <label>Received Amount</label>
                <input
                  type="number"
                  value={bulkPaymentAmount}
                  onChange={handleBulkPaymentChange}
                  placeholder="Enter received amount"
                />
              </div>
              {bulkPaymentResults.length > 0 && (
                <div className="bulk-payment-results">
                  <h4>Payment Distribution:</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Month/Year</th>
                        <th>Previous Due</th>
                        <th>Payment Applied</th>
                        <th>New Due</th>
                        <th>New Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPaymentResults.map((result, i) => (
                        <tr key={i}>
                          <td>{result.month}/{result.year}</td>
                          <td>Rs. {result.previousRemaining.toFixed(2)}</td>
                          <td>Rs. {result.paymentApplied.toFixed(2)}</td>
                          <td>Rs. {result.newRemaining.toFixed(2)}</td>
                          <td>{result.newStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {surplusAmount > 0 && (
                    <div className="surplus-section">
                      <div className="surplus-message">
                        Surplus Amount: Rs. {surplusAmount.toFixed(2)}
                      </div>
                      <div className="form-row">
                        <label>Surplus Action:</label>
                        <label>
                          <input
                            type="radio"
                            name="surplusAction"
                            value="deduct"
                            checked={surplusAction === "deduct"}
                            onChange={() => setSurplusAction("deduct")}
                          />
                          Deduct from next month's rent
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="surplusAction"
                            value="return"
                            checked={surplusAction === "return"}
                            onChange={() => setSurplusAction("return")}
                          />
                          Return to tenant
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="bulk-payment-actions">
                    <button onClick={handleSaveBulkPayment}>Apply Payment</button>
                    <button onClick={() => {
                      setShowBulkPayment(false);
                      setBulkPaymentAmount("");
                      setBulkPaymentResults([]);
                      setSurplusAmount(0);
                    }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rent Form - Only if selected user is NOT the owner themselves */}
      {selectedUserId && (
        (user?.role !== 'owner' || selectedUserId !== user.id.toString()) ? (
          <form onSubmit={handleCalculateSubmit} className="rent-form">
            <h2>{isEditing ? "Edit" : "Add"} Rent</h2>
            {!isEditing && (
              <div className="form-row">
                <label>Rent Duration</label>
                <select value={multiMonths} onChange={(e) => setMultiMonths(parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n} Month{n>1?"s":""}</option>)}
                </select>
              </div>
            )}
            <div className="form-row">
              <label>Year</label>
              <select name="year" value={form.year} onChange={handleFormChange} required>
                <option value="">--</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Month</label>
              <select name="month" value={form.month} onChange={handleFormChange} required disabled={!form.year}>
                <option value="">--</option>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Monthly Rent</label>
              <input name="rent" value={form.rent} onChange={handleFormChange} type="number" required />
            </div>
            <div className="form-row">
              <label>Water</label>
              <input name="water" value={form.water} onChange={handleFormChange} type="number" required />
            </div>
            <div className="form-row">
              <label>Waste</label>
              <input name="waste" value={form.waste} onChange={handleFormChange} type="number" required />
            </div>
            <div className="form-row">
              <label>Prev Electricity {history.length > 0 && !isEditing && "(Auto-filled)"}</label>
              <input
                name="prevElectricity"
                value={form.prevElectricity}
                onChange={handleFormChange}
                type="number"
                readOnly={history.length > 0 && !isEditing}
                required
                style={{
                  backgroundColor: history.length > 0 && !isEditing ? '#f0f0f0' : 'white'
                }}
              />
            </div>
            <div className="form-row">
              <label>Current Electricity</label>
              <input
                name="currElectricity"
                value={form.currElectricity}
                onChange={handleFormChange}
                type="number"
                required
              />
            </div>
            <div className="form-row">
              <label>Electricity Rate</label>
              <input
                name="electricityRate"
                value={form.electricityRate}
                onChange={handleFormChange}
                type="number"
                required
              />
            </div>
            <div className="form-row">
              <label>Internet</label>
              <label><input type="radio" name="internet" value="yes" checked={form.internet==="yes"} onChange={handleFormChange} /> Yes</label>
              <label><input type="radio" name="internet" value="no" checked={form.internet==="no"} onChange={handleFormChange} /> No</label>
            </div>
            {form.internet === "yes" && form.month && (
              <div className="form-row">
                <label>Internet Rate</label>
                <input
                  type="number"
                  value={internetRate}
                  onChange={(e) => setInternetRate(e.target.value)}
                  required
                />
                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                    Select Months for Internet:
                    <button 
                      type="button" 
                      onClick={handleSelectAllInternetMonths}
                      style={{ marginLeft: '10px', fontSize: '12px' }}
                    >
                      {selectedInternetMonths.size === getCalculationMonths().length ? 'Deselect All' : 'Select All'}
                    </button>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '5px' }}>
                    {getCalculationMonths().map((monthName, index) => (
                      <label key={monthName} style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                        <input
                          type="checkbox"
                          checked={selectedInternetMonths.has(monthName)}
                          onChange={() => handleInternetMonthToggle(monthName)}
                          style={{ marginRight: '5px' }}
                        />
                        {monthName} (Month {index + 1})
                      </label>
                    ))}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                    Selected: {selectedInternetMonths.size} month{selectedInternetMonths.size !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )}
            <div className="form-row">
              <label>Status</label>
              <select name="payment_status" value={form.payment_status} onChange={handleFormChange} required>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially Paid</option>
              </select>
            </div>
            {form.payment_status === "partially_paid" && (
              <div className="form-row">
                <label>Paid</label>
                <input name="paid_amount" value={form.paid_amount} onChange={handleFormChange} type="number" required />
                <label>Remaining</label>
                <input name="remaining_amount" value={form.remaining_amount} onChange={handleFormChange} type="number" readOnly />
              </div>
            )}
            <h3>Total: Rs. {total.toFixed(2)}</h3>
            <button type="submit">{isEditing ? "Update" : "Save"}</button>
            {isEditing && <button type="button" onClick={handleCancelEdit}>Cancel</button>}
          </form>
        ) : (
          <div className="alert" style={{ textAlign: 'center', marginTop: '20px' }}>
            <strong>You are viewing your own profile.</strong><br />
            Add tenants using the form above, then select them to manage rent.
          </div>
        )
      )}

      {selectedUserId && history.length > 0 && (
        <div className="history-section">
          <h2>Rent History</h2>
          <div className="bulk-actions">
            <button
              onClick={handleDeleteSelected}
              disabled={selectedEntries.size === 0}
              className="btn btn-danger"
            >
              Delete Selected ({selectedEntries.size})
            </button>
            <button
              onClick={handleDownloadCombinedPDF}
              disabled={selectedEntries.size === 0}
              className="btn btn-primary"
            >
              Download Combined PDF
            </button>
          </div>
          <table className="history-table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={() => {
                  setSelectedEntries(
                    selectedEntries.size === history.length
                      ? new Set()
                      : new Set(history.map(e => e.id))
                  );
                }} checked={selectedEntries.size === history.length} /></th>
                <th>Month/Year</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(entry => (
                <tr key={entry.id}>
                  <td><input type="checkbox" checked={selectedEntries.has(entry.id)} onChange={() => handleSelectEntry(entry.id)} /></td>
                  <td>{entry.month}/{entry.year}</td>
                  <td>Rs. {entry.total.toFixed(2)}</td>
                  <td>Rs. {entry.paid_amount.toFixed(2)}</td>
                  <td>Rs. {entry.remaining_amount.toFixed(2)}</td>
                  <td><span className={`status ${entry.payment_status}`}>{entry.payment_status}</span></td>
                  <td>
                    <button onClick={() => handleEdit(entry)}>Edit</button>
                    <button onClick={() => handleDelete(entry.id)}>Delete</button>
                    <button onClick={() => handleDownloadPDF(entry)}>PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'left',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h3>Notifications</h3>
            {notifications.length === 0 ? (
              <p>No notifications.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {notifications.map(n => (
  <li key={n.id} style={{
    border: '1px solid #ddd',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px',
    backgroundColor: n.is_read ? '#f8f9fa' : '#fff'
  }}>
    <strong>{n.tenant_name}</strong> {n.message}
    <br />
    <button
      onClick={() => deleteNotification(n.id)}
      style={{
        marginLeft: '22em',
        background: 'red',
        color: 'white',
        border: 'none',
        padding: '5px 10px',
        borderRadius: '5px',
        cursor: 'pointer'
      }}
    >
      Delete
    </button>
  </li>
))}
              </ul>
            )}
            <button
              onClick={() => setShowNotifications(false)}
              style={{
                marginTop: '10px',
                backgroundColor: '#f0f0f0',
                color: '#333',
                border: '1px solid #ccc',
                padding: '10px 20px',
                borderRadius: '5px',
                fontWeight: 'bold',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;