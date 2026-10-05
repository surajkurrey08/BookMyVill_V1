import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { canOperateProperty } from '../../lib/propertyAccess';
import SalesPipeline from './SalesPipeline';
import LeadsList from './LeadsList';
import QuotesList from './QuotesList';
import FollowUpsBoard from './FollowUpsBoard';
import LeadDrawer from './LeadDrawer';
import LeadForm from './LeadForm';
import QuoteBuilder from './QuoteBuilder';
import QuoteDrawer from './QuoteDrawer';
import { Alert } from './ui';
import './Sales.css';

const VIEWS = [
  { id: 'pipeline', label: 'Pipeline', icon: 'fa-chart-simple' },
  { id: 'leads', label: 'Leads', icon: 'fa-address-book' },
  { id: 'quotes', label: 'Quotations', icon: 'fa-file-invoice' },
  { id: 'followups', label: 'Follow-ups', icon: 'fa-bell' }
];

// Inquiry → quotation → booking workspace. Lists stay mounted per view; detail
// opens in drawers so the owner never loses their place in a list.
export default function SalesDesk({ ownerProperties }) {
  const [view, setView] = useState('pipeline');
  const [leadView, setLeadView] = useState('open');
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [leadId, setLeadId] = useState(null);
  const [quoteId, setQuoteId] = useState(null);
  const [leadForm, setLeadForm] = useState(null);
  const [builder, setBuilder] = useState(null);
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadMeta = useCallback(async () => {
    try { const data = await api('/owner-crm/meta'); setMeta({ ...data, properties: data.properties.filter(property => canOperateProperty(ownerProperties.find(item => item._id === property._id))) }); setMetaError(''); }
    catch (err) { setMetaError(err.message); }
  }, [ownerProperties]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const refresh = useCallback(() => setRefreshKey(key => key + 1), []);
  const notify = useCallback((text, kind = 'success') => setNotice({ text, kind, at: Date.now() }), []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const shared = { meta, refreshKey, onOpenLead: setLeadId, onOpenQuote: setQuoteId, notify };
  const openLeads = filterView => { setLeadView(filterView); setView('leads'); };

  return <div className="sd-panel">
    <div className="sd-head">
      <div>
        <h2>Inquiries & Quotations</h2>
        <p>Every lead from first message to confirmed booking, with follow-ups and quotations in one place.</p>
      </div>
      <div className="sd-head-actions">
        <button type="button" className="sd-btn ghost" onClick={() => setBuilder({})} disabled={!meta?.properties?.length}><i className="fa-solid fa-file-circle-plus" aria-hidden="true"></i> New quotation</button>
        <button type="button" className="sd-btn" onClick={() => setLeadForm({})}><i className="fa-solid fa-plus" aria-hidden="true"></i> New inquiry</button>
      </div>
    </div>

    <nav className="sd-subnav" aria-label="Sales sections">
      {VIEWS.map(item => <button key={item.id} type="button" className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}>
        <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i>{item.label}
      </button>)}
    </nav>

    {metaError && <Alert onClose={() => setMetaError('')}>{metaError} <button type="button" className="sd-link" onClick={loadMeta}>Retry</button></Alert>}
    {notice && <Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert>}
    {meta && !meta.properties.length && <Alert kind="warning">Add a property and at least one room in Rooms & Availability before sending quotations. You can still record inquiries.</Alert>}

    {view === 'pipeline' && <SalesPipeline {...shared} onOpenLeads={openLeads} onOpenView={setView} />}
    {view === 'leads' && <LeadsList {...shared} view={leadView} onViewChange={setLeadView} onNewLead={() => setLeadForm({})} />}
    {view === 'quotes' && <QuotesList {...shared} onNewQuote={() => setBuilder({})} />}
    {view === 'followups' && <FollowUpsBoard {...shared} onChanged={refresh} />}

    {leadId && <LeadDrawer {...shared} inquiryId={leadId} onClose={() => setLeadId(null)} onChanged={refresh}
      onEdit={inquiry => setLeadForm({ inquiry })} onNewQuote={inquiry => setBuilder({ inquiry })} />}
    {quoteId && <QuoteDrawer {...shared} quoteId={quoteId} onClose={() => setQuoteId(null)} onChanged={refresh}
      onEdit={quote => setBuilder({ quote })} onRevised={quote => { setQuoteId(quote._id); setBuilder({ quote }); }} />}
    {leadForm && <LeadForm {...shared} inquiry={leadForm.inquiry} onClose={() => setLeadForm(null)}
      onSaved={inquiry => { setLeadForm(null); refresh(); setLeadId(inquiry._id); notify(leadForm.inquiry ? 'Inquiry updated.' : `Inquiry ${inquiry.code} created.`); }}
      onOpenExisting={id => { setLeadForm(null); setLeadId(id); }} />}
    {builder && <QuoteBuilder {...shared} quote={builder.quote} inquiry={builder.inquiry} onClose={() => setBuilder(null)}
      onSaved={(quote, message) => { setBuilder(null); refresh(); setQuoteId(quote._id); notify(message); }} />}
  </div>;
}
