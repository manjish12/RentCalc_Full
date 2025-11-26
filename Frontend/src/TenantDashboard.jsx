// src/TenantDashboard.jsx
import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { AuthContext } from './AuthContext';
import "./Home.css";

const bsMonths = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

const TenantDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [qrUrl, setQrUrl] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [selectedEntryForPayment, setSelectedEntryForPayment] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchHistory();
      fetchQR();
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/rents?userId=${user.id}`);
      const sorted = res.data.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return bsMonths.indexOf(b.month) - bsMonths.indexOf(a.month);
      });
      setHistory(sorted);
    } catch (err) {
      console.error("Fetch history error:", err);
      alert("Failed to load rent history.");
    }
  };

  const fetchQR = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/qr/${user.linked_owner_id}`);
      setQrUrl(res.data.qr_image_url);
    } catch (err) {
      console.error("Fetch QR error:", err);
    }
  };

  const handleNotify = async () => {
    if (!selectedEntryForPayment) return;
    const now = new Date().toLocaleString();
    const message = `${user.name} has paid rent for ${selectedEntryForPayment.month} ${selectedEntryForPayment.year} on ${now}.`;
    try {
      await axios.post('http://localhost:5000/api/notify', {
        tenantId: user.id,
        message
      });
      alert('Owner has been notified!');
      setShowQR(false);
    } catch (err) {
      alert('Failed to notify owner.');
    }
  };

  const handleDownloadPDF = (entry) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Rent of ${user.name} - ${entry.month} ${entry.year}`, 14, 20);
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
    doc.text(`Payment Status: ${entry.payment_status}`, 14, yPos);
    yPos += 8;
    doc.text(`Paid Amount: Rs. ${entry.paid_amount.toFixed(2)}`, 14, yPos);
    yPos += 8;
    doc.text(`Remaining: Rs. ${entry.remaining_amount.toFixed(2)}`, 14, yPos);
    yPos += 8;
    doc.text(`Total: Rs. ${entry.total.toFixed(2)}`, 14, yPos);
    doc.save(`rent_${user.name}_${entry.month}_${entry.year}.pdf`);
  };

  const handleDownloadCombinedPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Rent History - ${user.name}`, 14, 20);
    doc.setFontSize(12);
    let y = 30;
    let grandTotal = 0;
    history.forEach((entry, index) => {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.text(`${entry.month} ${entry.year}`, 14, y);
      doc.setFontSize(10);
      y += 8;
      doc.text(`Total: Rs. ${entry.total.toFixed(2)}`, 20, y);
      y += 6;
      doc.text(`Status: ${entry.payment_status}`, 20, y);
      y += 12;
      grandTotal += entry.total;
    });
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    y += 10;
    doc.setFontSize(14);
    doc.text(`GRAND TOTAL: Rs. ${grandTotal.toFixed(2)}`, 14, y);
    doc.save(`rent_history_${user.name}.pdf`);
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="main-title">{user.name} Dashboard</h1>
        <button onClick={logout} className="btn-danger" style={{ padding: '8px 16px' }}>
          Logout
        </button>
      </div>

      {history.length > 0 && (
        <div className="history-section">
          <h2>Rent History</h2>
          <button onClick={handleDownloadCombinedPDF} className="btn-primary" style={{ marginBottom: '15px' }}>
            Download Full History PDF
          </button>
          <table className="history-table">
            <thead>
              <tr>
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
                  <td>{entry.month}/{entry.year}</td>
                  <td>Rs. {entry.total.toFixed(2)}</td>
                  <td>Rs. {entry.paid_amount.toFixed(2)}</td>
                  <td>Rs. {entry.remaining_amount.toFixed(2)}</td>
                  <td><span className={`status ${entry.payment_status}`}>{entry.payment_status}</span></td>
                  <td>
                    <button onClick={() => handleDownloadPDF(entry)}>PDF</button>
                    {(entry.payment_status === 'unpaid' || entry.payment_status === 'partially_paid') && qrUrl && (
                      <button 
                        onClick={() => {
                          setSelectedEntryForPayment(entry);
                          setShowQR(true);
                        }}
                        className="btn-primary"
                        style={{ marginLeft: '8px' }}
                      >
                        Pay Rent
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showQR && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center',
            width: '90%',
            maxWidth: '400px'
          }}>
            <h3>Scan to Pay Rent</h3>
            {qrUrl ? (
              <img src={qrUrl} alt="Payment QR" style={{ width: '250px', marginTop: '10px' }} />
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Owner has not uploaded a payment QR code.</p>
            )}
            <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleNotify}
                className="btn-primary"
                style={{
                  backgroundColor: '#6c5ce7',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                disabled={!qrUrl}
              >
                NOTIFY OWNER
              </button>
              <button
                onClick={() => setShowQR(false)}
                style={{
                  backgroundColor: '#f0f0f0',
                  color: '#333',
                  border: '1px solid #ccc',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantDashboard;