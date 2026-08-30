import React, { useState, useEffect, useRef } from 'react';
import { 
  Sliders, 
  Plus, 
  Trash2, 
  Play, 
  ArrowRight, 
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Edit2,
  Check,
  CheckCircle2, 
  AlertCircle, 
  HardDrive,
  Layers,
  FolderOpen,
  Search,
  Save,
  BookmarkCheck,
  Sparkles,
  GitBranch,
  GitMerge,
  Link2,
  Database,
  X,
  Code2,
  Terminal,
  Copy,
  FileCode,
  Activity,
  Table as TableIcon,
  BarChart2,
  CheckSquare,
  Square,
  Columns,
  Filter,
  ChevronDown,
  ChevronUp,
  MinusCircle,
  ListOrdered,
  Calculator,
  Type,
  Eye,
  EyeOff
} from 'lucide-react';
import { DataFlowAPI, extractErrorMessage } from '../../services/api';
import { DataGrid } from '../common/DataGrid';
import { ConfirmationModal } from '../common/ConfirmationModal';

const OPERATION_CATEGORIES = [
  {
    category: 'Row Filtering',
    items: [
      {
        id: 'filter',
        label: 'Filter Rows',
        subtitle: 'WHERE condition on column values',
        icon: Filter,
        badge: 'Filter'
      }
    ]
  },
  {
    category: 'Column Projection & Schema',
    items: [
      {
        id: 'select_columns',
        label: 'Select Columns',
        subtitle: 'Keep only specified columns',
        icon: Columns,
        badge: 'Project'
      },
      {
        id: 'drop_columns',
        label: 'Drop Columns',
        subtitle: 'Remove unwanted columns',
        icon: MinusCircle,
        badge: 'Exclude'
      },
      {
        id: 'rename_column',
        label: 'Rename Column',
        subtitle: 'Change column name in schema',
        icon: Edit2,
        badge: 'Rename'
      }
    ]
  },
  {
    category: 'Analytics & Aggregations',
    items: [
      {
        id: 'aggregate',
        label: 'Group By & Aggregate',
        subtitle: 'SUM, AVG, COUNT, MIN, MAX',
        icon: BarChart2,
        badge: 'Aggregate'
      },
      {
        id: 'window_function',
        label: 'Window Function & Ranking',
        subtitle: 'ROW_NUMBER, RANK, LEAD, LAG',
        icon: ListOrdered,
        badge: 'Window'
      }
    ]
  },
  {
    category: 'Calculations, Joins & SQL',
    items: [
      {
        id: 'join',
        label: 'Merge / Join Table',
        subtitle: 'Multi-table relational joins',
        icon: GitMerge,
        badge: 'Join'
      },
      {
        id: 'derived_column',
        label: 'Derived Column',
        subtitle: 'Math & column calculation formulas',
        icon: Calculator,
        badge: 'Formula'
      },
      {
        id: 'string_transform',
        label: 'String Cleansing',
        subtitle: 'UPPERCASE, lowercase, Trim',
        icon: Sparkles,
        badge: 'Cleanse'
      },
      {
        id: 'spark_sql',
        label: 'Custom Spark SQL',
        subtitle: 'Execute direct SQL expressions',
        icon: Terminal,
        badge: 'SQL'
      }
    ]
  }
];

export const TransformationStudioView = ({
  allDatasets = [],
  activeFlowId = null,
  flows = [],
  initialDatasetId = null,
  onSelectFlow = null,
  onProceedToExecution,
  onBackToStaging,
}) => {
  const [activeDataset, setActiveDataset] = useState(() => {
    try {
      const savedId = localStorage.getItem('dataflow_transform_active_stage_id') || initialDatasetId;
      if (savedId && Array.isArray(allDatasets) && allDatasets.length > 0) {
        return allDatasets.find((d) => d.id === savedId) || null;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [rules, setRules] = useState([]);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchStage, setSearchStage] = useState('');

  // Re-hydrate active dataset when datasets are loaded/updated from API
  useEffect(() => {
    if (activeDataset) return;
    try {
      const savedId = localStorage.getItem('dataflow_transform_active_stage_id') || initialDatasetId;
      if (savedId && Array.isArray(allDatasets) && allDatasets.length > 0) {
        const match = allDatasets.find((d) => d.id === savedId);
        if (match) {
          setActiveDataset(match);
        }
      }
    } catch {}
  }, [allDatasets, initialDatasetId]);

  // Persist active dataset ID to localStorage
  useEffect(() => {
    try {
      if (activeDataset?.id) {
        localStorage.setItem('dataflow_transform_active_stage_id', activeDataset.id);
      }
    } catch {}
  }, [activeDataset]);

  // Rule Builder & Editor State
  const [ruleType, setRuleType] = useState('filter');
  const [params, setParams] = useState({});
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [colSearchTerm, setColSearchTerm] = useState('');
  const [statsSearchTerm, setStatsSearchTerm] = useState('');
  const [selectedStatsCols, setSelectedStatsCols] = useState([]);

  // Preview Panel Visibility Toggle State
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);

  // Operation Dropdown Popover State
  const [isOpDropdownOpen, setIsOpDropdownOpen] = useState(false);
  const [opSearchTerm, setOpSearchTerm] = useState('');
  const opDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (opDropdownRef.current && !opDropdownRef.current.contains(e.target)) {
        setIsOpDropdownOpen(false);
      }
    };
    if (isOpDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpDropdownOpen]);

  // Persistence State
  const [savingRules, setSavingRules] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  const [selectedFlowFilter, setSelectedFlowFilter] = useState('all');

  // Helper to always resolve a valid target flow ID
  const resolveTargetFlowId = () => {
    return activeDataset?.flow_id || (activeFlowId !== 'all' ? activeFlowId : null) || (flows && flows[0]?.id) || null;
  };

  // Determine current effective flow
  const currentFlowId = resolveTargetFlowId();
  const currentFlow = flows.find((f) => f.id === currentFlowId) || { id: currentFlowId || '', name: currentFlowId ? `Flow ${currentFlowId}` : 'General Flow' };

  // Sync flow filter with activeFlowId prop
  useEffect(() => {
    if (activeFlowId && activeFlowId !== 'all') {
      setSelectedFlowFilter(activeFlowId);
    } else {
      setSelectedFlowFilter('all');
    }
  }, [activeFlowId]);

  // Load flow rules when dataset or flow changes
  useEffect(() => {
    const flowId = resolveTargetFlowId();
    if (flowId) {
      DataFlowAPI.getFlowRules(flowId)
        .then((res) => {
          if (res && Array.isArray(res.rules)) {
            setRules(res.rules);
          }
        })
        .catch((err) => console.error('Failed to load flow rules', err));
    }
  }, [activeDataset, activeFlowId, flows]);

  // Handle browser / mobile back button inside Transformation Studio
  useEffect(() => {
    const handleStudioPopState = (e) => {
      const state = e.state;
      // If we are currently inside the stage Rule Builder and the back button was pressed
      if (activeDataset && (!state || state.view !== 'stage_builder' || state.step !== 4)) {
        setActiveDataset(null);
        try {
          localStorage.removeItem('dataflow_transform_active_stage_id');
        } catch {}
      }
    };

    window.addEventListener('popstate', handleStudioPopState);
    return () => window.removeEventListener('popstate', handleStudioPopState);
  }, [activeDataset]);

  const handleSelectStage = async (ds) => {
    setActiveDataset(ds);
    try {
      localStorage.setItem('dataflow_transform_active_stage_id', ds.id);
      window.history.pushState({ step: 4, view: 'stage_builder', stageId: ds.id }, '', window.location.pathname);
    } catch {}
    setPreviewResult(null);
    setShowPreviewPanel(false);
    setErrorMsg(null);
    setEditingRuleId(null);
    setSaveSuccessMsg(null);
    setColSearchTerm('');
    setStatsSearchTerm('');
    setSelectedStatsCols([]);

    // If dataset belongs to a flow or active flow has rules, load them
    const flowId = ds.flow_id || resolveTargetFlowId();
    if (flowId) {
      try {
        const res = await DataFlowAPI.getFlowRules(flowId);
        if (res && Array.isArray(res.rules) && res.rules.length > 0) {
          setRules(res.rules);
        }
      } catch (err) {
        console.error('Failed to load rules for stage', err);
      }
    }
  };

  const handleBackToStagesList = () => {
    setActiveDataset(null);
    try {
      localStorage.removeItem('dataflow_transform_active_stage_id');
    } catch {}
    setPreviewResult(null);
    setShowPreviewPanel(false);
    setErrorMsg(null);
    setEditingRuleId(null);
    setSaveSuccessMsg(null);
  };

  const buildRuleDescription = (type, p, ds) => {
    if (type === 'select_columns') {
      const count = p.columns ? p.columns.length : 0;
      const sample = (p.columns || []).slice(0, 3).join(', ');
      return `Select ${count} Column${count === 1 ? '' : 's'}: [${sample}${count > 3 ? '...' : ''}]`;
    } else if (type === 'drop_columns') {
      const count = p.columns ? p.columns.length : 0;
      const sample = (p.columns || []).slice(0, 3).join(', ');
      return `Drop ${count} Column${count === 1 ? '' : 's'}: [${sample}${count > 3 ? '...' : ''}]`;
    } else if (type === 'filter') {
      return `Filter: ${p.condition || `${ds?.columns?.[0]?.name} IS NOT NULL`}`;
    } else if (type === 'join') {
      const targetDs = allDatasets.find((d) => d.id === p.target_dataset_id);
      const howUpper = (p.how || 'inner').toUpperCase();
      const targetName = targetDs?.name || p.target_dataset_id || 'Table';
      return `${howUpper} JOIN with '${targetName}' ON ${p.left_on || 'key'} = ${p.right_on || 'key'}`;
    } else if (type === 'derived_column') {
      return `${p.column_name || 'derived_metric'} = ${p.expression || '1 + 1'}`;
    } else if (type === 'aggregate') {
      const grp = (p.group_by || []).join(', ');
      const aggs = (p.aggregations || []).map((a) => `${(a.op || 'SUM').toUpperCase()}(${a.column || 'col'})`).join(', ');
      return grp ? `GROUP BY [${grp}]: ${aggs || 'COUNT(*)'}` : `Aggregate: ${aggs || 'COUNT(*)'}`;
    } else if (type === 'window_function') {
      const func = (p.function_type || 'ROW_NUMBER').toUpperCase();
      const val = p.value_column && !['ROW_NUMBER', 'RANK', 'DENSE_RANK'].includes(func) ? `(${p.value_column})` : '()';
      const part = (p.partition_by || []).length > 0 ? `PARTITION BY ${(p.partition_by || []).join(', ')} ` : '';
      const ord = p.order_by ? `ORDER BY ${p.order_by} ${p.order_direction || 'ASC'}` : '';
      const over = part || ord ? `OVER (${part}${ord})` : 'OVER ()';
      return `${func}${val} ${over} -> ${p.target_column || 'win_metric'}`;
    } else if (type === 'string_transform') {
      return `${(p.operation || 'upper').toUpperCase()}(${p.column || ds?.columns?.[0]?.name})`;
    } else if (type === 'rename_column') {
      return `Rename ${p.old_name || ds?.columns?.[0]?.name} -> ${p.new_name || 'new_col'}`;
    } else if (type === 'spark_sql') {
      return `SQL: ${(p.query || 'SELECT * FROM df').slice(0, 35)}...`;
    }
    return 'Transformation Step';
  };

  const autoSaveRules = async (newRules, flowId = null) => {
    const targetFlowId = flowId || resolveTargetFlowId();
    try {
      await DataFlowAPI.saveFlowRules(targetFlowId, newRules);
      setSaveSuccessMsg(`Saved ${newRules.length} rule${newRules.length === 1 ? '' : 's'} to Flow "${currentFlow?.name || targetFlowId}"`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.warn('Auto-saving flow rules error:', err);
    }
  };

  // Compute dynamic schema across the transformation DAG (including multi-table joins, derived & window columns)
  const getAvailableColumns = (upToRuleId = null) => {
    if (!activeDataset) return [];

    let cols = [...(activeDataset.columns || [])];
    const activeRules = rules.filter((r) => r.enabled);

    for (const r of activeRules) {
      if (upToRuleId && r.id === upToRuleId) break;

      if (r.rule_type === 'join') {
        const targetDs = allDatasets.find((d) => d.id === r.params?.target_dataset_id);
        if (targetDs && targetDs.columns) {
          const suffixRight = r.params?.suffix_right || '_joined';
          const rightOn = r.params?.right_on;
          const leftOn = r.params?.left_on;
          const selectedCols = r.params?.selected_columns;
          
          let targetColsToInclude = targetDs.columns;
          if (selectedCols && Array.isArray(selectedCols) && selectedCols.length > 0) {
            targetColsToInclude = targetDs.columns.filter((c) => selectedCols.includes(c.name) || c.name === rightOn);
          }

          const existingNames = new Set(cols.map((c) => c.name));
          const newCols = [];

          for (const tc of targetColsToInclude) {
            if (leftOn === rightOn && tc.name === rightOn) {
              continue; // Shared join key column
            }
            if (existingNames.has(tc.name)) {
              newCols.push({
                name: `${tc.name}${suffixRight}`,
                spark_type: tc.spark_type,
                origin: targetDs.name
              });
            } else {
              newCols.push({
                name: tc.name,
                spark_type: tc.spark_type,
                origin: targetDs.name
              });
            }
          }
          cols = [...cols, ...newCols];
        }
      } else if (r.rule_type === 'derived_column') {
        if (r.params?.column_name && !cols.some((c) => c.name === r.params.column_name)) {
          cols.push({ name: r.params.column_name, spark_type: 'DoubleType', origin: 'Derived' });
        }
      } else if (r.rule_type === 'window_function') {
        if (r.params?.target_column && !cols.some((c) => c.name === r.params.target_column)) {
          cols.push({ name: r.params.target_column, spark_type: 'LongType', origin: 'Window' });
        }
      } else if (r.rule_type === 'rename_column') {
        if (r.params?.old_name && r.params?.new_name) {
          cols = cols.map((c) => c.name === r.params.old_name ? { ...c, name: r.params.new_name } : c);
        }
      } else if (r.rule_type === 'drop_columns') {
        const dropSet = new Set(r.params?.columns || []);
        cols = cols.filter((c) => !dropSet.has(c.name));
      } else if (r.rule_type === 'select_columns') {
        const keepSet = new Set(r.params?.columns || []);
        if (keepSet.size > 0) {
          cols = cols.filter((c) => keepSet.has(c.name));
        }
      } else if (r.rule_type === 'aggregate') {
        const grp = r.params?.group_by || [];
        const aggs = (r.params?.aggregations || []).map((a) => a.alias || `${a.op || 'sum'}_${a.column || 'metric'}`);
        const newAggCols = [];
        for (const g of grp) {
          const found = cols.find((c) => c.name === g);
          newAggCols.push(found || { name: g, spark_type: 'StringType' });
        }
        for (const a of aggs) {
          newAggCols.push({ name: a, spark_type: 'DoubleType', origin: 'Aggregate' });
        }
        cols = newAggCols;
      }
    }

    return cols;
  };

  const handleSelectOperation = (newType) => {
    const availCols = getAvailableColumns(editingRuleId);
    setRuleType(newType);
    setIsOpDropdownOpen(false);
    setOpSearchTerm('');
    if (newType === 'select_columns') {
      setParams({ columns: availCols.map((c) => c.name) });
    } else if (newType === 'drop_columns') {
      setParams({ columns: [] });
    } else if (newType === 'aggregate') {
      setParams({
        group_by: [],
        aggregations: [{
          column: availCols[0]?.name || '',
          op: 'sum',
          alias: `sum_${availCols[0]?.name || 'metric'}`
        }]
      });
    } else if (newType === 'window_function') {
      setParams({
        function_type: 'row_number',
        target_column: 'row_num',
        partition_by: [],
        order_by: availCols[0]?.name || '',
        order_direction: 'ASC',
        value_column: availCols[0]?.name || '',
        offset: 1
      });
    } else {
      setParams({});
    }
  };

  const getCurrentOpDef = () => {
    for (const cat of OPERATION_CATEGORIES) {
      const found = cat.items.find((item) => item.id === ruleType);
      if (found) return found;
    }
    return OPERATION_CATEGORIES[0].items[0];
  };

  const handleSaveOrUpdateRule = () => {
    if (!activeDataset) return;
    const currentCols = getAvailableColumns(editingRuleId);
    let p = { ...params };

    if (ruleType === 'select_columns') {
      p.columns = p.columns && p.columns.length > 0 ? p.columns : currentCols.map((c) => c.name);
    } else if (ruleType === 'drop_columns') {
      p.columns = p.columns && p.columns.length > 0 ? p.columns : [currentCols[0]?.name].filter(Boolean);
    } else if (ruleType === 'filter') {
      p.condition = p.condition || `${currentCols[0]?.name || 'id'} IS NOT NULL`;
    } else if (ruleType === 'join') {
      const available = allDatasets.filter((d) => d.id !== activeDataset.id);
      const targetDs = available.find((d) => d.id === p.target_dataset_id) || available[0];
      if (!targetDs) {
        setErrorMsg("Please stage at least one other dataset to perform a table Join.");
        return;
      }
      p.target_dataset_id = targetDs.id;
      p.left_on = p.left_on || currentCols[0]?.name || 'id';
      p.right_on = p.right_on || targetDs.columns?.[0]?.name || currentCols[0]?.name;
      p.how = p.how || 'inner';
      p.suffix_right = p.suffix_right || `_${targetDs.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 10)}`;
    } else if (ruleType === 'derived_column') {
      p.column_name = p.column_name || 'derived_metric';
      p.expression = p.expression || '1 + 1';
    } else if (ruleType === 'aggregate') {
      p.group_by = p.group_by || [];
      p.aggregations = p.aggregations && p.aggregations.length > 0 ? p.aggregations : [
        { column: currentCols[0]?.name || 'col', op: 'sum', alias: `sum_${currentCols[0]?.name || 'col'}` }
      ];
    } else if (ruleType === 'window_function') {
      p.function_type = p.function_type || 'row_number';
      p.target_column = p.target_column || (p.function_type === 'row_number' ? 'row_num' : `${p.function_type}_col`);
      p.partition_by = p.partition_by || [];
      p.order_by = p.order_by || currentCols[0]?.name || '';
      p.order_direction = p.order_direction || 'ASC';
      p.value_column = p.value_column || currentCols[0]?.name;
      p.offset = p.offset || 1;
    } else if (ruleType === 'string_transform') {
      p.column = p.column || currentCols[0]?.name;
      p.operation = p.operation || 'upper';
    } else if (ruleType === 'rename_column') {
      p.old_name = p.old_name || currentCols[0]?.name;
      p.new_name = p.new_name || `${p.old_name}_new`;
    } else if (ruleType === 'spark_sql') {
      p.query = p.query || 'SELECT * FROM df';
    }

    const desc = buildRuleDescription(ruleType, p, activeDataset);
    let updatedRules = [];

    if (editingRuleId) {
      // Update existing rule
      updatedRules = rules.map((r) => r.id === editingRuleId ? {
        ...r,
        rule_type: ruleType,
        params: p,
        description: desc,
      } : r);
      setRules(updatedRules);
      setEditingRuleId(null);
    } else {
      // Add new rule
      const newRule = {
        id: `rule_${Date.now()}`,
        rule_type: ruleType,
        params: p,
        description: desc,
        enabled: true,
      };
      updatedRules = [...rules, newRule];
      setRules(updatedRules);
    }

    setParams({});
    // Auto-save immediately to database
    autoSaveRules(updatedRules);
    autoSaveRules(updatedRules);
  };

  const handleStartEdit = (rule) => {
    setEditingRuleId(rule.id);
    setRuleType(rule.rule_type);
    setParams({ ...rule.params });
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setParams({});
  };

  const handleToggle = (idx) => {
    const updated = [...rules];
    updated[idx].enabled = !updated[idx].enabled;
    setRules(updated);
    autoSaveRules(updated);
  };

  // Delete Rule Confirmation Modal State
  const [deleteRuleConfirmModal, setDeleteRuleConfirmModal] = useState({
    isOpen: false,
    ruleIdx: null,
    ruleType: '',
    ruleDescription: ''
  });

  const promptDeleteRule = (idx) => {
    setDeleteRuleConfirmModal({
      isOpen: true,
      ruleIdx: idx,
      ruleType: rules[idx]?.rule_type || 'Rule',
      ruleDescription: rules[idx]?.description || ''
    });
  };

  const confirmDeleteRule = () => {
    const idx = deleteRuleConfirmModal.ruleIdx;
    if (idx === null || idx === undefined) return;
    const updated = rules.filter((_, i) => i !== idx);
    setRules(updated);
    if (editingRuleId && rules[idx]?.id === editingRuleId) {
      handleCancelEdit();
    }
    autoSaveRules(updated);
    setDeleteRuleConfirmModal({ isOpen: false, ruleIdx: null, ruleType: '', ruleDescription: '' });
  };

  const handleDelete = (idx) => {
    promptDeleteRule(idx);
  };

  const handleMoveRule = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= rules.length) return;
    const updated = [...rules];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setRules(updated);
    autoSaveRules(updated);
  };

  const handleSaveRulesToFlow = async () => {
    const targetFlowId = currentFlowId || activeDataset?.flow_id || activeFlowId;
    if (!targetFlowId) {
      setErrorMsg('No active Flow selected to save transformation rules.');
      return;
    }
    setSavingRules(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    try {
      await DataFlowAPI.saveFlowRules(targetFlowId, rules);
      setSaveSuccessMsg(`Saved ${rules.length} rules to flow '${currentFlow.name}'!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err, 'Failed to save rules to flow'));
    } finally {
      setSavingRules(false);
    }
  };

  const handlePreview = async () => {
    if (!activeDataset) return;
    setPreviewLoading(true);
    setErrorMsg(null);
    setShowPreviewPanel(true);
    try {
      const activeOnly = rules.filter((r) => r.enabled);
      const res = await DataFlowAPI.previewTransform(activeDataset.id, activeOnly);
      setPreviewResult(res);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err, 'Transformation preview failed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleProceed = async () => {
    const targetFlowId = currentFlowId || activeDataset?.flow_id || activeFlowId;
    // Persist rules to flow before proceeding if flow is selected
    if (targetFlowId && rules.length > 0) {
      try {
        await DataFlowAPI.saveFlowRules(targetFlowId, rules);
      } catch (e) {
        console.warn('Auto-save rules before proceeding failed:', e);
      }
    }
    onProceedToExecution(activeDataset, rules.filter((r) => r.enabled), targetFlowId);
  };

  const filteredStages = allDatasets.filter((ds) => {
    if (selectedFlowFilter !== 'all' && ds.flow_id !== selectedFlowFilter) {
      return false;
    }
    if (!searchStage.trim()) return true;
    const term = searchStage.toLowerCase();
    const flowObj = flows.find((f) => f.id === ds.flow_id);
    const flowName = flowObj ? flowObj.name.toLowerCase() : '';
    return ds.name.toLowerCase().includes(term) || 
           ds.id.toLowerCase().includes(term) ||
           flowName.includes(term);
  });

  const getFlowDatasetCount = (flowId) => {
    if (flowId === 'all') return allDatasets.length;
    return allDatasets.filter((d) => d.flow_id === flowId).length;
  };

  const [activePreviewTab, setActivePreviewTab] = useState('data'); // 'data', 'stats', 'pyspark', 'sql', 'plan'
  const [copiedType, setCopiedType] = useState(null);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const getDynamicPySparkCode = () => {
    if (previewResult?.generated_pyspark_code) return previewResult.generated_pyspark_code;
    const dsName = activeDataset?.name || 'staged_dataset';
    const lines = [
      `# ====================================================================`,
      `# Apache PySpark Transformation Pipeline — Lakehouse Dataset: ${dsName}`,
      `# Generated by DataFlow SparkLake Studio`,
      `# ====================================================================`,
      `from pyspark.sql import SparkSession`,
      `from pyspark.sql import functions as F`,
      `from pyspark.sql.types import *`,
      ``,
      `# 1. Initialize High-Performance Spark Session`,
      `spark = SparkSession.builder \\`,
      `    .appName('DataFlow_Transformation_DAG') \\`,
      `    .config('spark.sql.adaptive.enabled', 'true') \\`,
      `    .getOrCreate()`,
      ``,
      `# 2. Read Source Dataset: ${dsName}`,
      `df = spark.read.table('lakehouse_staging.${dsName}')`,
      ``
    ];
    const activeRules = rules.filter((r) => r.enabled);
    if (activeRules.length === 0) {
      lines.push(`# No active transformation rules configured.`);
      lines.push(`df_transformed = df`);
    } else {
      lines.push(`# 3. Apply Configured Transformation Steps`);
      activeRules.forEach((r, i) => {
        lines.push(`# Step ${i + 1}: ${r.description || r.rule_type}`);
        if (r.rule_type === 'select_columns') {
          const cols = (r.params?.columns || []).map((c) => `'${c}'`).join(', ');
          lines.push(`df = df.select(${cols || '*'})`);
        } else if (r.rule_type === 'drop_columns') {
          const cols = (r.params?.columns || []).map((c) => `'${c}'`).join(', ');
          lines.push(`df = df.drop(${cols})`);
        } else if (r.rule_type === 'aggregate') {
          const grp = (r.params?.group_by || []).map((c) => `'${c}'`).join(', ');
          const aggs = (r.params?.aggregations || []).map((a) => {
            const op = (a.op || 'sum').toLowerCase();
            const alias = a.alias || `${op}_${a.column || 'col'}`;
            if (op === 'count_distinct') return `F.countDistinct('${a.column}').alias('${alias}')`;
            if (op === 'stddev') return `F.stddev('${a.column}').alias('${alias}')`;
            return `F.${op}('${a.column}').alias('${alias}')`;
          }).join(', ');
          if (grp) {
            lines.push(`df = df.groupBy(${grp}).agg(${aggs || "F.count('*').alias('count')"})`);
          } else {
            lines.push(`df = df.agg(${aggs || "F.count('*').alias('count')"})`);
          }
        } else if (r.rule_type === 'window_function') {
          const func = (r.params?.function_type || 'row_number').toLowerCase();
          const targetCol = r.params?.target_column || 'window_metric';
          const valCol = r.params?.value_column;
          const part = (r.params?.partition_by || []).map((c) => `'${c}'`).join(', ');
          const ord = r.params?.order_by;
          const dir = (r.params?.order_direction || 'asc').toLowerCase();
          const offset = r.params?.offset || 1;

          const winParts = [];
          if (part) winParts.push(`Window.partitionBy(${part})`);
          else winParts.push('Window');
          if (ord) winParts.push(`orderBy(F.col('${ord}').${dir}())`);
          const winSpec = winParts.join('.');

          let callExpr = `F.row_number().over(${winSpec})`;
          if (func === 'rank') callExpr = `F.rank().over(${winSpec})`;
          else if (func === 'dense_rank') callExpr = `F.dense_rank().over(${winSpec})`;
          else if (func === 'lead' || func === 'lag') callExpr = `F.${func}('${valCol}', ${offset}).over(${winSpec})`;
          else if (func !== 'row_number') callExpr = `F.${func}('${valCol}').over(${winSpec})`;

          lines.push(`from pyspark.sql.window import Window`);
          lines.push(`df = df.withColumn('${targetCol}', ${callExpr})`);
        } else if (r.rule_type === 'derived_column') {
          lines.push(`df = df.withColumn('${r.params?.column_name || 'metric'}', F.expr("${r.params?.expression || '1'}"))`);
        } else if (r.rule_type === 'string_transform') {
          const op = r.params?.operation || 'upper';
          lines.push(`df = df.withColumn('${r.params?.column}', F.${op}(F.col('${r.params?.column}')))`);
        } else if (r.rule_type === 'rename_column') {
          lines.push(`df = df.withColumnRenamed('${r.params?.old_name}', '${r.params?.new_name}')`);
        } else if (r.rule_type === 'join') {
          const targetDs = allDatasets.find((d) => d.id === r.params?.target_dataset_id);
          const targetName = targetDs?.name || r.params?.target_dataset_id;
          lines.push(`df_target_${i + 1} = spark.read.table('lakehouse_staging.${targetName}')`);
          lines.push(`df = df.join(df_target_${i + 1}, df['${r.params?.left_on}'] == df_target_${i + 1}['${r.params?.right_on}'], how='${r.params?.how || 'inner'}')`);
        } else if (r.rule_type === 'spark_sql') {
          lines.push(`df.createOrReplaceTempView('source_view_${i + 1}')`);
          lines.push(`df = spark.sql("""${r.params?.query || 'SELECT * FROM df'}""")`);
        }
        lines.push(``);
      });
      lines.push(`df_transformed = df`);
    }
    lines.push(``);
    lines.push(`# 4. Display / Materialize Result`);
    lines.push(`df_transformed.show(50, truncate=False)`);
    return lines.join('\n');
  };

  const getDynamicSqlCode = () => {
    if (previewResult?.generated_sql_query) return previewResult.generated_sql_query;
    const dsName = activeDataset?.name || 'staged_dataset';
    const activeRules = rules.filter((r) => r.enabled);
    if (activeRules.length === 0) return `SELECT * FROM lakehouse_staging.${dsName};`;

    const ctes = [`source_data AS (\n    SELECT * FROM lakehouse_staging.${dsName}\n)`];
    let prev = 'source_data';
    activeRules.forEach((r, i) => {
      const cte = `step_${i + 1}_${r.rule_type}`;
      if (r.rule_type === 'select_columns') {
        const cols = (r.params?.columns || []).map((c) => `"${c}"`).join(', ');
        ctes.push(`${cte} AS (\n    SELECT ${cols || '*'} FROM ${prev}\n)`);
      } else if (r.rule_type === 'drop_columns') {
        const cols = (r.params?.columns || []).map((c) => `"${c}"`).join(', ');
        ctes.push(`${cte} AS (\n    SELECT * EXCLUDE (${cols}) FROM ${prev}\n)`);
      } else if (r.rule_type === 'aggregate') {
        const grp = (r.params?.group_by || []).map((c) => `"${c}"`).join(', ');
        const aggs = (r.params?.aggregations || []).map((a) => {
          const op = (a.op || 'SUM').toUpperCase();
          const alias = a.alias || `${op.toLowerCase()}_${a.column || 'col'}`;
          if (op === 'COUNT_DISTINCT') return `COUNT(DISTINCT "${a.column}") AS "${alias}"`;
          return `${op}("${a.column}") AS "${alias}"`;
        }).join(', ');
        const selectCols = [grp, aggs].filter(Boolean).join(', ');
        const grpClause = grp ? ` GROUP BY ${grp}` : '';
        ctes.push(`${cte} AS (\n    SELECT ${selectCols || '*'} FROM ${prev}${grpClause}\n)`);
      } else if (r.rule_type === 'window_function') {
        const func = (r.params?.function_type || 'ROW_NUMBER').toUpperCase();
        const targetCol = r.params?.target_column || 'window_metric';
        const valCol = r.params?.value_column;
        const part = (r.params?.partition_by || []).map((c) => `"${c}"`).join(', ');
        const ord = r.params?.order_by;
        const dir = (r.params?.order_direction || 'ASC').toUpperCase();
        const offset = r.params?.offset || 1;

        let fExpr = `${func}()`;
        if (func === 'LEAD' || func === 'LAG') fExpr = `${func}("${valCol}", ${offset})`;
        else if (!['ROW_NUMBER', 'RANK', 'DENSE_RANK'].includes(func)) fExpr = `${func}("${valCol}")`;

        const overParts = [];
        if (part) overParts.push(`PARTITION BY ${part}`);
        if (ord) overParts.push(`ORDER BY "${ord}" ${dir}`);
        const overClause = `OVER (${overParts.join(' ')})`;

        ctes.push(`${cte} AS (\n    SELECT *, ${fExpr} ${overClause} AS "${targetCol}"\n    FROM ${prev}\n)`);
      } else if (r.rule_type === 'filter') {
        ctes.push(`${cte} AS (\n    SELECT * FROM ${prev}\n    WHERE ${r.params?.condition || '1=1'}\n)`);
      } else if (r.rule_type === 'derived_column') {
        ctes.push(`${cte} AS (\n    SELECT *, (${r.params?.expression || '1'}) AS ${r.params?.column_name || 'metric'}\n    FROM ${prev}\n)`);
      } else if (r.rule_type === 'string_transform') {
        const op = (r.params?.operation || 'upper').toUpperCase();
        ctes.push(`${cte} AS (\n    SELECT *, ${op}(${r.params?.column}) AS ${r.params?.column}\n    FROM ${prev}\n)`);
      } else if (r.rule_type === 'rename_column') {
        ctes.push(`${cte} AS (\n    SELECT *, ${r.params?.old_name} AS ${r.params?.new_name}\n    FROM ${prev}\n)`);
      } else if (r.rule_type === 'join') {
        const targetDs = allDatasets.find((d) => d.id === r.params?.target_dataset_id);
        const targetName = targetDs?.name || r.params?.target_dataset_id;
        const how = (r.params?.how || 'inner').toUpperCase();
        ctes.push(`${cte} AS (\n    SELECT l.*, r.*\n    FROM ${prev} l\n    ${how} JOIN lakehouse_staging.${targetName} r\n        ON l.${r.params?.left_on} = r.${r.params?.right_on}\n)`);
      } else if (r.rule_type === 'spark_sql') {
        ctes.push(`${cte} AS (\n    ${r.params?.query || `SELECT * FROM ${prev}`}\n)`);
      } else {
        ctes.push(`${cte} AS (\n    SELECT * FROM ${prev}\n)`);
      }
      prev = cte;
    });
    return `-- ====================================================================\n-- SparkLake SQL Transformation Query — Lakehouse Dataset: ${dsName}\n-- ====================================================================\nWITH ${ctes.join(',\n')}\nSELECT * FROM ${prev};`;
  };

  // ==========================================
  // VIEW: STAGES GALLERY SELECTION
  // ==========================================
  if (!activeDataset) {
    return (
      <div className="space-y-5 animate-fadeIn">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-4 h-4 text-zinc-500 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Select Staged Dataset to Transform
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {allDatasets.length} dataset{allDatasets.length === 1 ? '' : 's'} across {flows.length} flows ready for transformations.
              </p>
            </div>
          </div>

          {allDatasets.length > 0 && (
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter datasets or flows..."
                value={searchStage}
                onChange={(e) => setSearchStage(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-full sm:w-52 font-sans"
              />
            </div>
          )}
        </div>

        {/* FLOW SELECTOR TABS BAR */}
        {flows.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setSelectedFlowFilter('all');
                onSelectFlow && onSelectFlow('all');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 ${
                selectedFlowFilter === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <span>All Flows</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                selectedFlowFilter === 'all'
                  ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
              }`}>
                {getFlowDatasetCount('all')}
              </span>
            </button>

            {flows.map((flow) => {
              const isSelected = selectedFlowFilter === flow.id;
              const count = getFlowDatasetCount(flow.id);
              return (
                <button
                  key={flow.id}
                  type="button"
                  onClick={() => {
                    setSelectedFlowFilter(flow.id);
                    onSelectFlow && onSelectFlow(flow.id);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>{flow.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {filteredStages.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center text-zinc-500 dark:text-zinc-400 text-xs space-y-3">
            <FolderOpen className="w-8 h-8 text-zinc-400 mx-auto mb-1" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {allDatasets.length === 0 ? 'No Staged Sets Found' : 'No Staged Datasets In This Flow'}
            </h3>
            <p className="max-w-sm mx-auto text-zinc-400">
              {allDatasets.length === 0
                ? "You haven't staged any data yet. Please connect a data source and stage it in the Staging Area."
                : "This flow does not have any staged datasets yet. Switch flow or connect a source."}
            </p>
            <button
              type="button"
              onClick={onBackToStaging}
              className="mt-2 px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-medium inline-flex items-center space-x-1.5 shadow-xs"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Go to Staging Area</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredStages.map((ds) => {
              const flowObj = flows.find((f) => f.id === ds.flow_id);
              return (
                <div
                  key={ds.id}
                  onClick={() => handleSelectStage(ds)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-lg p-4 shadow-xs transition-colors cursor-pointer flex flex-col justify-between group space-y-3.5"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      {flowObj ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 truncate max-w-[170px]">
                          <GitBranch className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="truncate">{flowObj.name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          General
                        </span>
                      )}

                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                        {ds.source_type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 min-w-0 pr-1">
                      <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                        <Sliders className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {ds.name}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2">
                      {ds.description || ds.source_summary || 'Staged Apache Parquet Lakehouse table.'}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 space-x-1.5">
                      <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{ds.row_count.toLocaleString()}</strong> rows
                      <span>•</span>
                      <span>{ds.column_count} cols</span>
                    </div>

                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Build Rules</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: RULE STUDIO & LIVE PREVIEW
  // ==========================================
  return (
    <div className="space-y-5 animate-fadeIn pb-20 sm:pb-8">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs transition-colors">
        <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBackToStagesList}
            className="p-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1 text-xs font-medium shrink-0 mt-0.5 sm:mt-0"
            title="Back to stages list"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stages</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 mb-0.5">
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 uppercase shrink-0">
                ACTIVE STAGE
              </span>
              {currentFlow && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 truncate max-w-[150px] sm:max-w-none shrink-0">
                  FLOW: {currentFlow.name}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
              {activeDataset.name}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
              ID: {activeDataset.id} • {activeDataset.row_count.toLocaleString()} rows • {activeDataset.column_count} cols
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || rules.length === 0}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
            <span>{previewLoading ? 'Executing...' : 'Live Preview'}</span>
          </button>

          {/* Toggle Preview Visibility (Hidden on mobile screens) */}
          {showPreviewPanel ? (
            <button
              type="button"
              onClick={() => setShowPreviewPanel(false)}
              className="hidden sm:inline-flex justify-center px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium items-center space-x-1.5 transition-colors shrink-0"
              title="Hide Preview Panel"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide Preview</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!previewResult && rules.length > 0) {
                  handlePreview();
                } else {
                  setShowPreviewPanel(true);
                }
              }}
              className="hidden sm:inline-flex justify-center px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium items-center space-x-1.5 transition-colors shrink-0"
              title="Show Preview Panel"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Show Preview</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleProceed}
            disabled={rules.length === 0}
            className="flex-1 sm:flex-initial justify-center px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
          >
            <span>Run Pipeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-400 text-xs flex items-center space-x-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left / Main Column: Rule Builder & Sequence */}
        <div className={showPreviewPanel ? "lg:col-span-5 space-y-4" : "lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-5"}>
          {/* Rule Builder / Editor Card */}
          <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs space-y-3 transition-colors ${
            !showPreviewPanel ? 'lg:col-span-5' : ''
          }`}>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 uppercase tracking-wider">
                {editingRuleId ? (
                  <>
                    <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Edit Transformation Rule</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Add Transformation Rule</span>
                  </>
                )}
              </h4>

              {editingRuleId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center space-x-1"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Custom Operation Dropdown with Icons & Categories (No Emojis) */}
              <div className="relative" ref={opDropdownRef}>
                <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">
                  Operation
                </label>
                
                {/* Trigger Button */}
                {(() => {
                  const currentOp = getCurrentOpDef();
                  const IconComp = currentOp.icon;

                  return (
                    <button
                      type="button"
                      onClick={() => setIsOpDropdownOpen(!isOpDropdownOpen)}
                      className={`w-full px-3 py-2 bg-white dark:bg-zinc-950 border rounded-md text-xs transition-colors flex items-center justify-between shadow-xs ${
                        isOpDropdownOpen
                          ? 'border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700">
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left truncate">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {currentOp.label}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {currentOp.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {currentOp.badge}
                        </span>
                        {isOpDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </button>
                  );
                })()}

                {/* Dropdown Menu Popover */}
                {isOpDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-fadeIn">
                    {/* Quick Search */}
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search operations..."
                          value={opSearchTerm}
                          onChange={(e) => setOpSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-8 pr-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                      </div>
                    </div>

                    {/* Categorized Options List */}
                    <div className="max-h-80 overflow-y-auto custom-scrollbar p-1.5 space-y-2">
                      {OPERATION_CATEGORIES.map((category) => {
                        const filteredItems = category.items.filter(
                          (it) => !opSearchTerm.trim() || 
                            it.label.toLowerCase().includes(opSearchTerm.toLowerCase()) ||
                            it.subtitle.toLowerCase().includes(opSearchTerm.toLowerCase())
                        );

                        if (filteredItems.length === 0) return null;

                        return (
                          <div key={category.category} className="space-y-1">
                            <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                              {category.category}
                            </div>
                            <div className="grid grid-cols-1 gap-1">
                              {filteredItems.map((item) => {
                                const isSelected = ruleType === item.id;
                                const IconComponent = item.icon;

                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectOperation(item.id)}
                                    className={`w-full p-2 rounded-md text-left transition-colors flex items-center justify-between group ${
                                      isSelected
                                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5 min-w-0">
                                      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border ${
                                        isSelected
                                          ? 'bg-white/20 border-white/30 text-white dark:bg-zinc-900/20 dark:border-zinc-900/30 dark:text-zinc-900'
                                          : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                      }`}>
                                        <IconComponent className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold truncate">
                                          {item.label}
                                        </div>
                                        <div className={`text-[10px] truncate ${
                                          isSelected ? 'text-white/80 dark:text-zinc-900/80' : 'text-zinc-500 dark:text-zinc-400'
                                        }`}>
                                          {item.subtitle}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                                      <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-medium ${
                                        isSelected
                                          ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                      }`}>
                                        {item.badge}
                                      </span>
                                      {isSelected && (
                                        <Check className="w-3.5 h-3.5 shrink-0" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {(ruleType === 'select_columns' || ruleType === 'drop_columns') && (() => {
                const allCols = getAvailableColumns(editingRuleId);
                const selectedCols = params.columns !== undefined
                  ? params.columns
                  : (ruleType === 'select_columns' ? allCols.map((c) => c.name) : []);

                const filteredCols = allCols.filter((c) =>
                  !colSearchTerm.trim() ||
                  c.name.toLowerCase().includes(colSearchTerm.toLowerCase()) ||
                  c.spark_type.toLowerCase().includes(colSearchTerm.toLowerCase())
                );

                const isSelectMode = ruleType === 'select_columns';

                const toggleCol = (colName) => {
                  let updated;
                  if (selectedCols.includes(colName)) {
                    updated = selectedCols.filter((c) => c !== colName);
                  } else {
                    updated = [...selectedCols, colName];
                  }
                  setParams({ ...params, columns: updated });
                };

                const handleSelectAll = () => {
                  setParams({ ...params, columns: allCols.map((c) => c.name) });
                };

                const handleClearAll = () => {
                  setParams({ ...params, columns: [] });
                };

                return (
                  <div className="space-y-2.5 p-3 bg-zinc-50/50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {isSelectMode ? 'Columns to Keep' : 'Columns to Remove'}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        {selectedCols.length} of {allCols.length} selected
                      </span>
                    </div>

                    {/* Search and Quick Selection Actions */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Filter columns..."
                          value={colSearchTerm}
                          onChange={(e) => setColSearchTerm(e.target.value)}
                          className="w-full pl-7 pr-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="px-2 py-1 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors whitespace-nowrap"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="px-2 py-1 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors whitespace-nowrap"
                      >
                        None
                      </button>
                    </div>

                    {/* Column Checkboxes Grid */}
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {filteredCols.length === 0 ? (
                        <p className="text-xs text-zinc-400 py-3 text-center">No matching columns found.</p>
                      ) : (
                        filteredCols.map((col) => {
                          const isChecked = selectedCols.includes(col.name);
                          return (
                            <div
                              key={col.name}
                              onClick={() => toggleCol(col.name)}
                              className={`flex items-center justify-between p-1.5 rounded border text-xs cursor-pointer select-none transition-colors ${
                                isChecked
                                  ? 'bg-zinc-100 dark:bg-zinc-800/90 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium'
                                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800/60 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0 w-3.5 h-3.5 pointer-events-none"
                                />
                                <span className="font-mono text-xs truncate">{col.name}</span>
                              </div>
                              <span className="font-mono text-[10px] text-zinc-400 shrink-0 ml-2">
                                {col.spark_type}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'filter' && (() => {
                const availCols = getAvailableColumns(editingRuleId);
                return (
                  <div className="space-y-1.5">
                    <label className="block text-xs text-zinc-700 dark:text-zinc-300 font-medium">WHERE Condition</label>
                    <input
                      type="text"
                      value={params.condition || ''}
                      onChange={(e) => setParams({ ...params, condition: e.target.value })}
                      placeholder="amount > 100 AND status = 'COMPLETED'"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                    <div className="flex items-center space-x-1 overflow-x-auto py-0.5 custom-scrollbar text-[10px] text-zinc-500">
                      <span className="shrink-0 text-zinc-400">Insert Column:</span>
                      {availCols.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            const cond = params.condition ? `${params.condition} ${c.name}` : c.name;
                            setParams({ ...params, condition: cond });
                          }}
                          className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono shrink-0 transition-colors"
                          title={`Click to append ${c.name}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'join' && (() => {
                const available = allDatasets.filter((d) => d.id !== activeDataset.id);
                const selectedTargetId = params.target_dataset_id || available[0]?.id;
                const selectedTarget = available.find((d) => d.id === selectedTargetId) || available[0];
                const targetCols = selectedTarget?.columns || [];
                const currentCols = getAvailableColumns(editingRuleId);
                const joinTypes = [
                  { id: 'inner', label: 'Inner' },
                  { id: 'left', label: 'Left' },
                  { id: 'right', label: 'Right' },
                  { id: 'outer', label: 'Full Outer' },
                  { id: 'cross', label: 'Cross' },
                ];
                const activeHow = params.how || 'inner';

                if (available.length === 0) {
                  return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-md text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Stage at least 2 datasets to join tables.</span>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 p-3 bg-zinc-50/50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 animate-fadeIn">
                    {/* Target Table */}
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">
                        Target Table
                      </label>
                      <select
                        value={selectedTargetId || ''}
                        onChange={(e) => {
                          const newTarget = available.find((d) => d.id === e.target.value);
                          setParams({
                            ...params,
                            target_dataset_id: e.target.value,
                            right_on: newTarget?.columns?.[0]?.name || '',
                            suffix_right: newTarget ? `_${newTarget.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 10)}` : '_joined'
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      >
                        {available.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.row_count} rows)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Join Type */}
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">
                        Join Type
                      </label>
                      <div className="grid grid-cols-5 gap-1">
                        {joinTypes.map((jt) => {
                          const isSelected = activeHow === jt.id;
                          return (
                            <button
                              key={jt.id}
                              type="button"
                              onClick={() => setParams({ ...params, how: jt.id })}
                              className={`py-1 px-1.5 rounded-md border text-center text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 shadow-xs'
                                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              {jt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Key Columns */}
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">
                        Join Keys
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={params.left_on || currentCols[0]?.name || ''}
                          onChange={(e) => setParams({ ...params, left_on: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono"
                        >
                          {currentCols.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name} {c.origin ? `(${c.origin})` : ''}
                            </option>
                          ))}
                        </select>

                        <select
                          value={params.right_on || targetCols[0]?.name || ''}
                          onChange={(e) => setParams({ ...params, right_on: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono"
                        >
                          {targetCols.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Column Suffix */}
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">
                        Column Suffix (for duplicate column names)
                      </label>
                      <input
                        type="text"
                        value={params.suffix_right || '_joined'}
                        onChange={(e) => setParams({ ...params, suffix_right: e.target.value })}
                        placeholder="_joined"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'derived_column' && (() => {
                const availCols = getAvailableColumns(editingRuleId);
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">New Column Name</label>
                        <input
                          type="text"
                          value={params.column_name || ''}
                          onChange={(e) => setParams({ ...params, column_name: e.target.value })}
                          placeholder="total_revenue"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">Formula / Expression</label>
                        <input
                          type="text"
                          value={params.expression || ''}
                          onChange={(e) => setParams({ ...params, expression: e.target.value })}
                          placeholder="unit_price * quantity"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 overflow-x-auto py-0.5 custom-scrollbar text-[10px] text-zinc-500">
                      <span className="shrink-0 text-zinc-400">Available Columns:</span>
                      {availCols.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            const expr = params.expression ? `${params.expression} ${c.name}` : c.name;
                            setParams({ ...params, expression: expr });
                          }}
                          className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono shrink-0 transition-colors"
                          title={`Click to insert ${c.name}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'string_transform' && (() => {
                const availCols = getAvailableColumns(editingRuleId);
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">Column</label>
                      <select
                        value={params.column || availCols[0]?.name}
                        onChange={(e) => setParams({ ...params, column: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono"
                      >
                        {availCols.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} {c.origin ? `(${c.origin})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">Action</label>
                      <select
                        value={params.operation || 'upper'}
                        onChange={(e) => setParams({ ...params, operation: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="upper">UPPERCASE</option>
                        <option value="lower">lowercase</option>
                        <option value="trim">Trim</option>
                      </select>
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'rename_column' && (() => {
                const availCols = getAvailableColumns(editingRuleId);
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">Old Column</label>
                      <select
                        value={params.old_name || availCols[0]?.name}
                        onChange={(e) => setParams({ ...params, old_name: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono"
                      >
                        {availCols.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} {c.origin ? `(${c.origin})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">New Name</label>
                      <input
                        type="text"
                        value={params.new_name || ''}
                        onChange={(e) => setParams({ ...params, new_name: e.target.value })}
                        placeholder="renamed_column"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'aggregate' && (() => {
                const allCols = getAvailableColumns(editingRuleId);
                const selectedGroupBy = params.group_by || [];
                const aggregations = params.aggregations && params.aggregations.length > 0 
                  ? params.aggregations 
                  : [{ column: allCols[0]?.name || '', op: 'sum', alias: `sum_${allCols[0]?.name || 'metric'}` }];

                const toggleGroupBy = (colName) => {
                  let updated;
                  if (selectedGroupBy.includes(colName)) {
                    updated = selectedGroupBy.filter((c) => c !== colName);
                  } else {
                    updated = [...selectedGroupBy, colName];
                  }
                  setParams({ ...params, group_by: updated, aggregations });
                };

                const updateAgg = (idx, field, val) => {
                  const updated = [...aggregations];
                  updated[idx] = { ...updated[idx], [field]: val };
                  if (field === 'column' || field === 'op') {
                    const op = field === 'op' ? val : (updated[idx].op || 'sum');
                    const col = field === 'column' ? val : (updated[idx].column || 'col');
                    updated[idx].alias = `${op.toLowerCase()}_${col}`;
                  }
                  setParams({ ...params, group_by: selectedGroupBy, aggregations: updated });
                };

                const addAgg = () => {
                  const newCol = allCols[0]?.name || '';
                  const newAgg = { column: newCol, op: 'sum', alias: `sum_${newCol}` };
                  setParams({ ...params, group_by: selectedGroupBy, aggregations: [...aggregations, newAgg] });
                };

                const removeAgg = (idx) => {
                  if (aggregations.length <= 1) return;
                  const updated = aggregations.filter((_, i) => i !== idx);
                  setParams({ ...params, group_by: selectedGroupBy, aggregations: updated });
                };

                return (
                  <div className="space-y-3 p-3 bg-zinc-50/50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 animate-fadeIn">
                    {/* Group By Dimensions */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <label className="font-medium text-zinc-700 dark:text-zinc-300">
                          Group By Dimensions (Optional)
                        </label>
                        <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                          {selectedGroupBy.length} selected
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                        {allCols.map((col) => {
                          const isSelected = selectedGroupBy.includes(col.name);
                          return (
                            <button
                              key={col.name}
                              type="button"
                              onClick={() => toggleGroupBy(col.name)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors border flex items-center space-x-1 ${
                                isSelected
                                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-medium'
                                  : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <span>{col.name}</span>
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Aggregation Measures List */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <label className="font-medium text-zinc-700 dark:text-zinc-300">
                          Aggregation Measures ({aggregations.length})
                        </label>
                        <button
                          type="button"
                          onClick={addAgg}
                          className="text-[11px] text-zinc-900 dark:text-zinc-100 font-medium hover:underline flex items-center space-x-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Measure</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {aggregations.map((agg, aIdx) => (
                          <div key={aIdx} className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-2">
                            <div className="grid grid-cols-12 gap-1.5 items-center">
                              {/* Agg Op */}
                              <div className="col-span-4">
                                <label className="block text-[10px] text-zinc-400 mb-0.5">Function</label>
                                <select
                                  value={agg.op || 'sum'}
                                  onChange={(e) => updateAgg(aIdx, 'op', e.target.value)}
                                  className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none"
                                >
                                  <option value="sum">SUM</option>
                                  <option value="avg">AVG</option>
                                  <option value="count">COUNT</option>
                                  <option value="count_distinct">COUNT DISTINCT</option>
                                  <option value="min">MIN</option>
                                  <option value="max">MAX</option>
                                  <option value="stddev">STDDEV</option>
                                </select>
                              </div>

                              {/* Target Col */}
                              <div className="col-span-4">
                                <label className="block text-[10px] text-zinc-400 mb-0.5">Column</label>
                                <select
                                  value={agg.column || allCols[0]?.name}
                                  onChange={(e) => updateAgg(aIdx, 'column', e.target.value)}
                                  className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                                >
                                  {allCols.map((c) => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Alias Output */}
                              <div className="col-span-3">
                                <label className="block text-[10px] text-zinc-400 mb-0.5">Output Name</label>
                                <input
                                  type="text"
                                  value={agg.alias || ''}
                                  onChange={(e) => updateAgg(aIdx, 'alias', e.target.value)}
                                  className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                                />
                              </div>

                              {/* Remove button */}
                              <div className="col-span-1 pt-3.5 flex justify-center">
                                <button
                                  type="button"
                                  onClick={() => removeAgg(aIdx)}
                                  disabled={aggregations.length <= 1}
                                  className="p-1 text-zinc-400 hover:text-red-500 disabled:opacity-20 transition-colors"
                                  title="Remove Measure"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'window_function' && (() => {
                const allCols = getAvailableColumns(editingRuleId);
                const selectedFunction = params.function_type || 'row_number';
                const targetCol = params.target_column || (selectedFunction === 'row_number' ? 'row_num' : `${selectedFunction}_col`);
                const valCol = params.value_column || allCols[0]?.name;
                const partitionBy = params.partition_by || [];
                const orderBy = params.order_by || allCols[0]?.name;
                const orderDir = params.order_direction || 'ASC';
                const offset = params.offset || 1;

                const requiresValCol = !['row_number', 'rank', 'dense_rank'].includes(selectedFunction);
                const isOffsetFunc = ['lead', 'lag'].includes(selectedFunction);

                const togglePartitionCol = (colName) => {
                  let updated;
                  if (partitionBy.includes(colName)) {
                    updated = partitionBy.filter((c) => c !== colName);
                  } else {
                    updated = [...partitionBy, colName];
                  }
                  setParams({ ...params, partition_by: updated });
                };

                const functionOptions = [
                  { group: 'Ranking', items: [
                    { id: 'row_number', label: 'ROW_NUMBER()' },
                    { id: 'rank', label: 'RANK()' },
                    { id: 'dense_rank', label: 'DENSE_RANK()' }
                  ]},
                  { group: 'Cumulative & Metrics', items: [
                    { id: 'sum', label: 'SUM() Running Total' },
                    { id: 'avg', label: 'AVG() Running Average' },
                    { id: 'min', label: 'MIN() Over Window' },
                    { id: 'max', label: 'MAX() Over Window' }
                  ]},
                  { group: 'Offsets & Lookups', items: [
                    { id: 'lag', label: 'LAG() Previous Row' },
                    { id: 'lead', label: 'LEAD() Next Row' }
                  ]}
                ];

                return (
                  <div className="space-y-3 p-3 bg-zinc-50/50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 animate-fadeIn">
                    {/* Function Type Selector */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Window Function
                      </label>
                      <select
                        value={selectedFunction}
                        onChange={(e) => {
                          const f = e.target.value;
                          setParams({
                            ...params,
                            function_type: f,
                            target_column: f === 'row_number' ? 'row_num' : `${f}_metric`
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none"
                      >
                        {functionOptions.map((grp) => (
                          <optgroup key={grp.group} label={grp.group}>
                            {grp.items.map((it) => (
                              <option key={it.id} value={it.id}>{it.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Target Output Column Name */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          New Output Column
                        </label>
                        <input
                          type="text"
                          value={targetCol}
                          onChange={(e) => setParams({ ...params, target_column: e.target.value })}
                          placeholder="row_num"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                      </div>

                      {requiresValCol && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Source Value Column
                          </label>
                          <select
                            value={valCol}
                            onChange={(e) => setParams({ ...params, value_column: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                          >
                            {allCols.map((c) => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {isOffsetFunc && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Offset Row Count
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={offset}
                          onChange={(e) => setParams({ ...params, offset: parseInt(e.target.value) || 1 })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Partition By */}
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <label className="font-medium text-zinc-700 dark:text-zinc-300">
                          Partition By (Group Over Window)
                        </label>
                        <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                          {partitionBy.length} selected
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                        {allCols.map((col) => {
                          const isSelected = partitionBy.includes(col.name);
                          return (
                            <button
                              key={col.name}
                              type="button"
                              onClick={() => togglePartitionCol(col.name)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors border flex items-center space-x-1 ${
                                isSelected
                                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-medium'
                                  : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <span>{col.name}</span>
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Order By & Direction */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Order By Column & Direction
                      </label>
                      <div className="grid grid-cols-12 gap-1.5">
                        <select
                          value={orderBy}
                          onChange={(e) => setParams({ ...params, order_by: e.target.value })}
                          className="col-span-8 px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                        >
                          {allCols.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>

                        <div className="col-span-4 grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => setParams({ ...params, order_direction: 'ASC' })}
                            className={`py-1 rounded text-center text-xs font-mono font-medium transition-colors border ${
                              orderDir === 'ASC'
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            ASC
                          </button>
                          <button
                            type="button"
                            onClick={() => setParams({ ...params, order_direction: 'DESC' })}
                            className={`py-1 rounded text-center text-xs font-mono font-medium transition-colors border ${
                              orderDir === 'DESC'
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            DESC
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'spark_sql' && (
                <div>
                  <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-medium">SQL Query on Table 'df'</label>
                  <textarea
                    rows={2}
                    value={params.query || ''}
                    onChange={(e) => setParams({ ...params, query: e.target.value })}
                    placeholder="SELECT *, (amount * 1.05) as amount_with_tax FROM df"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveOrUpdateRule}
                  className="flex-1 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                >
                  {editingRuleId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{editingRuleId ? 'Update Rule' : 'Add Rule to Pipeline'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rules Pipeline Stack with Edit & Reorder controls */}
          <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs space-y-3 transition-colors ${
            !showPreviewPanel ? 'lg:col-span-7' : ''
          }`}>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 uppercase tracking-wider">
                <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                <span>Configured Rules ({rules.length})</span>
              </h4>

              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                Auto-saved
              </span>
            </div>

            {rules.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center font-mono">No transformation rules configured yet.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className={`p-2.5 rounded-md border text-xs transition-colors space-y-1.5 ${
                      editingRuleId === rule.id
                        ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600'
                        : rule.enabled
                          ? 'bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
                          : 'bg-zinc-100/40 dark:bg-zinc-950/20 border-dashed border-zinc-200 dark:border-zinc-800 opacity-60'
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-medium flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-[10px] uppercase font-medium text-zinc-700 dark:text-zinc-300 px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 shrink-0">
                          {rule.rule_type}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveRule(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 transition-colors"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveRule(idx, 1)}
                          disabled={idx === rules.length - 1}
                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEdit(rule)}
                          className={`p-1 transition-colors ${
                            editingRuleId === rule.id ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                          }`}
                          title="Edit Rule"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(idx)}
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium uppercase transition-colors ${
                            rule.enabled
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                              : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {rule.enabled ? 'ON' : 'OFF'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(idx)}
                          className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-words pl-5">
                      {rule.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Action when Preview is Hidden */}
            {!showPreviewPanel && rules.length > 0 && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                <span className="font-mono text-[11px] text-zinc-400">Preview panel is hidden</span>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewLoading}
                  className="px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-40"
                >
                  <Play className={`w-3 h-3 ${previewLoading ? 'animate-spin' : ''}`} />
                  <span>{previewLoading ? 'Executing...' : 'Run & Show Preview'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Data Preview & Code Inspector */}
        {showPreviewPanel && (
          <div className="lg:col-span-7 space-y-3 animate-fadeIn">
            {/* Top Inspector Tab Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-lg shadow-xs">
              <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('data')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 whitespace-nowrap ${
                    activePreviewTab === 'data'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Data Table</span>
                  {previewResult && (
                    <span className="text-[10px] font-mono opacity-80">
                      ({previewResult.transformed_rows.toLocaleString()})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('stats')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 whitespace-nowrap ${
                    activePreviewTab === 'stats'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Column Stats</span>
                  {previewResult && (
                    <span className="text-[10px] font-mono opacity-80">
                      ({previewResult.columns.length})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('pyspark')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 whitespace-nowrap ${
                    activePreviewTab === 'pyspark'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>PySpark Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('sql')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 whitespace-nowrap ${
                    activePreviewTab === 'sql'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Spark SQL</span>
                </button>

                {previewResult && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('plan')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 whitespace-nowrap ${
                      activePreviewTab === 'plan'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Execution Plan</span>
                  </button>
                )}
              </div>

              {/* Action Buttons: Copy & Hide Preview */}
              <div className="flex items-center space-x-1.5 self-end sm:self-auto shrink-0">
                {(activePreviewTab === 'pyspark' || activePreviewTab === 'sql') && (
                  <button
                    type="button"
                    onClick={() => handleCopy(
                      activePreviewTab === 'pyspark' ? getDynamicPySparkCode() : getDynamicSqlCode(),
                      activePreviewTab
                    )}
                    className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center justify-center transition-colors shrink-0"
                    title={copiedType === activePreviewTab ? "Copied!" : `Copy ${activePreviewTab === 'pyspark' ? 'PySpark' : 'SQL'} code`}
                  >
                    {copiedType === activePreviewTab ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {/* Hide Preview Button (Hidden on mobile screens) */}
                <button
                  type="button"
                  onClick={() => setShowPreviewPanel(false)}
                  className="hidden sm:inline-flex items-center space-x-1 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition-colors shrink-0"
                  title="Hide Preview Panel"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Hide</span>
                </button>
              </div>
            </div>

            {/* TAB 1: DATA TABLE */}
            {activePreviewTab === 'data' && (
              previewResult ? (
                <div className="space-y-3 animate-fadeIn">
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 sm:p-3 grid grid-cols-3 gap-2 text-center sm:flex sm:items-center sm:justify-between text-xs font-mono text-zinc-700 dark:text-zinc-300">
                    <div>
                      <span className="text-[10px] text-zinc-400 block sm:inline sm:mr-1">Time:</span>
                      <strong>{previewResult.execution_time_ms.toFixed(1)}ms</strong>
                    </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block sm:inline sm:mr-1">Rows:</span>
                    <strong>{previewResult.initial_rows.toLocaleString()} → {previewResult.transformed_rows.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block sm:inline sm:mr-1">Cols:</span>
                    <strong>{previewResult.columns.length}</strong>
                  </div>
                </div>

                <DataGrid
                  title={`Live Preview (${activeDataset.name})`}
                  subtitle={`Applied ${rules.filter((r) => r.enabled).length} transformations on stage dataset`}
                  columns={previewResult.columns}
                  rows={previewResult.preview_rows}
                  totalRows={previewResult.transformed_rows}
                  pageSize={25}
                  currentPage={1}
                  onPageChange={() => {}}
                />
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center text-zinc-400 text-xs space-y-2">
                <Sliders className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-600" />
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Live Transformation Preview</p>
                <p>Add rules on the left and click <strong>Live Preview</strong> to inspect the transformed schema & rows.</p>
                <p className="text-xs text-zinc-500">Or click the <strong>PySpark Code</strong> / <strong>Spark SQL</strong> tabs above to view the generated pipeline code.</p>
              </div>
            )
          )}

          {/* TAB 2: COLUMN STATS */}
          {activePreviewTab === 'stats' && (
            previewResult ? (() => {
              const allProfileCols = previewResult.columns || [];
              const filteredProfileCols = allProfileCols.filter((col) => {
                const matchesSearch = !statsSearchTerm.trim() || 
                  col.name.toLowerCase().includes(statsSearchTerm.toLowerCase()) || 
                  col.spark_type.toLowerCase().includes(statsSearchTerm.toLowerCase());
                
                const matchesSelection = selectedStatsCols.length === 0 || selectedStatsCols.includes(col.name);
                return matchesSearch && matchesSelection;
              });

              const totalCols = allProfileCols.length;
              const totalRows = previewResult.transformed_rows || 0;
              const totalNulls = allProfileCols.reduce((acc, c) => acc + (c.null_count || 0), 0);
              const avgCompleteness = totalCols > 0 && totalRows > 0 
                ? Math.max(0, 100 - (totalNulls / (totalCols * totalRows) * 100)).toFixed(1)
                : '100.0';

              return (
                <div className="space-y-3 animate-fadeIn">
                  {/* KPI Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">Transformed Columns</span>
                      <span className="text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">{totalCols}</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">Total Rows</span>
                      <span className="text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">{totalRows.toLocaleString()}</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">Data Completeness</span>
                      <span className="text-base font-semibold font-mono text-emerald-600 dark:text-emerald-400">{avgCompleteness}%</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">Total Null Cells</span>
                      <span className="text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">{totalNulls.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Filter Toolbar for Column Stats */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search column statistics..."
                          value={statsSearchTerm}
                          onChange={(e) => setStatsSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="text-[11px] text-zinc-500 font-medium">Focus Columns:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedStatsCols([])}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            selectedStatsCols.length === 0
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                          }`}
                        >
                          All ({totalCols})
                        </button>
                      </div>
                    </div>

                    {/* Column Quick Filter Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-y-auto custom-scrollbar pt-1">
                      {allProfileCols.map((col) => {
                        const isSelected = selectedStatsCols.includes(col.name);
                        return (
                          <button
                            key={col.name}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedStatsCols(selectedStatsCols.filter((c) => c !== col.name));
                              } else {
                                setSelectedStatsCols([...selectedStatsCols, col.name]);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors border flex items-center space-x-1 ${
                              isSelected
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-semibold'
                                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <span>{col.name}</span>
                            {isSelected && <X className="w-2.5 h-2.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detailed Column Statistics Table */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-zinc-100/70 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 tracking-wider">
                            <th className="py-2.5 px-3">Column</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Completeness</th>
                            <th className="py-2.5 px-3">Distinct Values</th>
                            <th className="py-2.5 px-3">Min / Max Range</th>
                            <th className="py-2.5 px-3">Sample Values</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono">
                          {filteredProfileCols.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs font-sans">
                                No column statistics matching your filter criteria.
                              </td>
                            </tr>
                          ) : (
                            filteredProfileCols.map((col) => {
                              const completeness = totalRows > 0 
                                ? Math.max(0, 100 - (col.null_percentage || 0))
                                : 100;
                              return (
                                <tr key={col.name} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/40 transition-colors">
                                  <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                                    {col.name}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[10px] text-zinc-700 dark:text-zinc-300">
                                      {col.spark_type}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 min-w-[130px]">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className={completeness === 100 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-zinc-600 dark:text-zinc-400'}>
                                          {completeness.toFixed(1)}% valid
                                        </span>
                                        <span className="text-zinc-400">
                                          {col.null_count || 0} nulls
                                        </span>
                                      </div>
                                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className={`h-1.5 rounded-full ${
                                            completeness === 100
                                              ? 'bg-emerald-500'
                                              : completeness > 80
                                                ? 'bg-amber-500'
                                                : 'bg-red-500'
                                          }`}
                                          style={{ width: `${completeness}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">
                                    <span className="font-semibold">{col.distinct_count || 0}</span>
                                    <span className="text-[10px] text-zinc-400 block">
                                      {totalRows > 0 ? `${((col.distinct_count / totalRows) * 100).toFixed(1)}% unique` : ''}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400 text-[11px] whitespace-nowrap">
                                    {col.min_value !== null && col.min_value !== undefined && col.max_value !== null && col.max_value !== undefined ? (
                                      <span>{col.min_value} → {col.max_value}</span>
                                    ) : (
                                      <span className="text-zinc-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                      {(col.sample_values || []).slice(0, 3).map((val, vIdx) => (
                                        <span
                                          key={vIdx}
                                          className="px-1 py-0.2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-[10px] truncate max-w-[90px]"
                                          title={String(val)}
                                        >
                                          {String(val)}
                                        </span>
                                      ))}
                                      {(col.sample_values || []).length > 3 && (
                                        <span className="text-[9px] text-zinc-400 font-sans">+{(col.sample_values || []).length - 3} more</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center text-zinc-400 text-xs space-y-2">
                <BarChart2 className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-600" />
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Column Statistics Profiler</p>
                <p>Click <strong>Live Preview</strong> to calculate and inspect transformed column metrics, null distributions, and cardinality statistics.</p>
              </div>
            )
          )}

          {/* TAB 2: PYSPARK CODE */}
          {activePreviewTab === 'pyspark' && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-xs animate-fadeIn">
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-zinc-300 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>pipeline_transform.py (Apache PySpark)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(getDynamicPySparkCode(), 'pyspark')}
                  className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                  title="Copy PySpark code"
                >
                  {copiedType === 'pyspark' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto max-h-[500px] leading-relaxed select-all">
                <code>{getDynamicPySparkCode()}</code>
              </pre>
            </div>
          )}

          {/* TAB 3: SPARK SQL */}
          {activePreviewTab === 'sql' && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-xs animate-fadeIn">
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-zinc-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  <span>transformation_query.sql (Spark SQL / DuckDB)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(getDynamicSqlCode(), 'sql')}
                  className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                  title="Copy SQL query"
                >
                  {copiedType === 'sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto max-h-[500px] leading-relaxed select-all">
                <code>{getDynamicSqlCode()}</code>
              </pre>
            </div>
          )}

          {/* TAB 4: EXECUTION PLAN & STEP METRICS */}
          {activePreviewTab === 'plan' && previewResult && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-4 shadow-xs animate-fadeIn">
              <div>
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Physical Execution Plan</span>
                </h4>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-800 dark:text-zinc-200">
                  {previewResult.spark_plan || 'Physical Plan: Spark Scan -> Join / Filter -> Project -> Materialize'}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-2">
                  Transformation Step Breakdown
                </h4>
                <div className="space-y-2">
                  {previewResult.step_summaries && previewResult.step_summaries.length > 0 ? (
                    previewResult.step_summaries.map((step, sIdx) => (
                      <div key={sIdx} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Step {step.step_index}: {step.rule_type.toUpperCase()}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{step.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{step.output_rows.toLocaleString()} rows</span>
                          <span className="text-[10px] text-zinc-400 block">{step.columns_count} cols</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-400">No multi-step breakdown available.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Delete Transformation Rule Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteRuleConfirmModal.isOpen}
        title={`Delete Transformation Rule?`}
        message={`Are you sure you want to remove this ${deleteRuleConfirmModal.ruleType.toUpperCase()} rule? "${deleteRuleConfirmModal.ruleDescription}"`}
        confirmText="Delete Rule"
        cancelText="Cancel"
        variant="danger"
        isLoading={false}
        onConfirm={confirmDeleteRule}
        onCancel={() => setDeleteRuleConfirmModal({ isOpen: false, ruleIdx: null, ruleType: '', ruleDescription: '' })}
      />
    </div>
  );
};
