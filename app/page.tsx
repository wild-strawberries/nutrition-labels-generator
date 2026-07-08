'use client';

import { useMemo, useState, useEffect } from 'react';
import ciqualData from '../ciqual_filtered.json';

type IngredientRecord = Record<string, any> & { ingr_id: string; ingr_name: string };

type IngredientRow = {
  id: string;
  ingredientName: string;
  quantity: number;
  unit: 'g';
  error?: string;
};

type NutritionTotals = Record<string, number>;

type ExportPayload = {
  productName: string;
  finalWeight: number;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    ingredientId: string;
  }>;
  nutritionTotals: NutritionTotals;
  nutritionPer100g: NutritionTotals;
};

type SavedLabel = {
  filename: string;
  productName: string;
  data: ExportPayload;
};

// derive nutrient keys from data
const rawIngredientOptions = ciqualData as IngredientRecord[];
const inferredNutrientKeys = (() => {
  const first = rawIngredientOptions[0] || {};
  return Object.keys(first).filter((k) => {
    if (['ingr_id', 'ingr_name', 'ingr_group'].includes(k)) return false;
    return typeof (first as any)[k] === 'number';
  });
})();

function prettyLabel(key: string) {
  switch (key) {
    case 'fat_sat':
      return 'Saturated';
    case 'fat_monoin':
      return 'Monounsaturated';
    case 'fat_polyin':
      return 'Polyunsaturated';
    case 'protein_total':
      return 'Protein';
    case 'carb_sugar':
      return 'Sugars';
    case 'fat_total':
      return 'Total Fat';
    case 'carb_total':
      return 'Total Carbohydrates';
    default:
      return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function getUnitForKey(key: string) {
  if (key === 'energy_kcal') return 'kcal';
  if (key === 'energy_kj') return 'kJ';
  if (key.includes('cholesterol')) return 'mg';
  return 'g';
}

const ingredientOptions = ciqualData as IngredientRecord[];
const ingredientNames = ingredientOptions.map((item) => item.ingr_name).sort((a, b) => a.localeCompare(b));

const fatDetailKeys = ['fat_sat', 'fat_monoin', 'fat_polyin', 'cholesterol'];
const carbDetailKeys = ['carb_sugar'];
const excludedNutrientKeys = [
  'energy_kcal',
  'energy_kj',
  'fat_total',
  'fat_sat',
  'fat_monoin',
  'fat_polyin',
  'cholesterol',
  'carb_total',
  'carb_sugar'
];

function formatValue(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) < 0.1) return value.toFixed(2);
  return value.toFixed(1);
}

function shouldShowFatDetails(nutrition?: NutritionTotals | null) {
  if (!nutrition) return true;
  const fatCalories = (nutrition['fat_total'] || 0) * 9;
  const energyKcal = nutrition['energy_kcal'] || 0;
  if (energyKcal <= 0) return true;
  return fatCalories / energyKcal >= 0.3;
}

function sanitizeNumericInput(value: string) {
  const normalized = value.replace(/^0+(?=\d)/, '');
  return normalized === '' ? 0 : Number(normalized);
}

function emptyRow(index: number): IngredientRow {
  return {
    id: `row-${Date.now()}-${index}`,
    ingredientName: '',
    quantity: 100,
    unit: 'g'
  };
}

function NutritionTable({ nutritionPer100g, nutrientKeys, fatDetailsVisible }: { nutritionPer100g: NutritionTotals; nutrientKeys: string[]; fatDetailsVisible: boolean }) {
  return (
    <table>
      <tbody>
        {/* Energy row */}
        {nutrientKeys.includes('energy_kcal') || nutrientKeys.includes('energy_kj') ? (
          <tr className="group-row">
            <td>Energy</td>
            <td>
              {nutrientKeys.includes('energy_kcal') ? `${formatValue(nutritionPer100g['energy_kcal'])} kcal` : ''}
              {nutrientKeys.includes('energy_kcal') && nutrientKeys.includes('energy_kj') ? ' / ' : ''}
              {nutrientKeys.includes('energy_kj') ? `${formatValue(nutritionPer100g['energy_kj'])} kJ` : ''}
            </td>
          </tr>
        ) : null}

        {/* Fat group */}
        {nutrientKeys.includes('fat_total') ? (
          <>
            <tr className="group-row">
              <td>Total Fat</td>
              <td>{formatValue(nutritionPer100g['fat_total'])} {getUnitForKey('fat_total')}</td>
            </tr>
            {fatDetailsVisible
              ? fatDetailKeys.map((k) =>
                  nutrientKeys.includes(k) ? (
                    <tr key={k} className="sub-row">
                      <td className="sub-label">{prettyLabel(k)}</td>
                      <td>{formatValue(nutritionPer100g[k])} {getUnitForKey(k)}</td>
                    </tr>
                  ) : null
                )
              : null}
          </>
        ) : null}

        {/* Carbohydrates group */}
        {nutrientKeys.includes('carb_total') ? (
          <>
            <tr className="group-row">
              <td>Total Carbohydrates</td>
              <td>{formatValue(nutritionPer100g['carb_total'])} {getUnitForKey('carb_total')}</td>
            </tr>
            {carbDetailKeys.map((k) =>
              nutrientKeys.includes(k) ? (
                <tr key={k} className="sub-row">
                  <td className="sub-label">{prettyLabel(k)}</td>
                  <td>{formatValue(nutritionPer100g[k])} {getUnitForKey(k)}</td>
                </tr>
              ) : null
            )}
          </>
        ) : null}

        {/* other nutrients */}
        {nutrientKeys
          .filter((k) => !excludedNutrientKeys.includes(k))
          .map((k) => (
            <tr key={k} className="group-row">
              <td>{prettyLabel(k)}</td>
              <td>{formatValue(nutritionPer100g[k])} {getUnitForKey(k)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

export default function HomePage() {
  const [currentView, setCurrentView] = useState<'new' | 'saved'>('new');
  const [productName, setProductName] = useState('');
  const [rows, setRows] = useState<IngredientRow[]>([emptyRow(1)]);
  const [finalWeight, setFinalWeight] = useState(0);
  const [nutritionPer100g, setNutritionPer100g] = useState<NutritionTotals | null>(null);
  const [readyExportPayload, setReadyExportPayload] = useState<ExportPayload | null>(null);
  const [canSave, setCanSave] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const [savedLabels, setSavedLabels] = useState<SavedLabel[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<SavedLabel | null>(null);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [editingFilename, setEditingFilename] = useState<string | null>(null);

  const ingredientMap = new Map(ingredientOptions.map((item) => [item.ingr_name, item]));
  const nutrientKeys = inferredNutrientKeys;

  const sortedIngredientRows = useMemo(() => {
    return [...rows].sort((a, b) => b.quantity - a.quantity);
  }, [rows]);

  const fatDetailsVisible = useMemo(() => shouldShowFatDetails(nutritionPer100g), [nutritionPer100g]);
  const selectedLabelFatDetailsVisible = useMemo(
    () => shouldShowFatDetails(selectedLabel?.data?.nutritionPer100g),
    [selectedLabel]
  );

  // Load saved labels when switching to saved view
  useEffect(() => {
    if (currentView === 'saved') {
      loadSavedLabels();
    }
  }, [currentView]);

  const loadSavedLabels = async () => {
    setLoadingLabels(true);
    try {
      const response = await fetch('/api/labels');
      if (response.ok) {
        const data = await response.json();
        setSavedLabels(data);
        if (data.length > 0 && !selectedLabel) {
          setSelectedLabel(data[0]);
        }
        // clear any editing state when reloading list
        setEditingFilename(null);
      }
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
    setLoadingLabels(false);
  };

    const loadLabelIntoForm = (label: SavedLabel) => {
      // populate form fields for editing
      setProductName(label.productName || '');
      const mappedRows = (label.data.ingredients || []).map((ing, idx) => ({
        id: `row-${Date.now()}-${idx}`,
        ingredientName: ing.name,
        quantity: ing.quantity,
        unit: 'g' as const
      }));
      setRows(mappedRows.length ? mappedRows : [emptyRow(1)]);
      setFinalWeight(label.data.finalWeight || 0);
      setNutritionPer100g(label.data.nutritionPer100g || null);
      setReadyExportPayload(null);
      setCanSave(false);
      setEditingFilename(label.filename);
      setCurrentView('new');
    };

  const updateRow = (index: number, row: Partial<IngredientRow>) => {
    setRows((current) =>
      current.map((item, idx) => (idx === index ? { ...item, ...row } : item))
    );
    setCanSave(false);
  };

  const addRow = () => {
    setRows((current) => [...current, emptyRow(current.length + 1)]);
    setCanSave(false);
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, idx) => idx !== index));
    setCanSave(false);
  };

  const runCalculation = async () => {
    setExportMessage(null);
    setCalculationError(null);

    if (productName.trim() === '') {
      setCalculationError('Product name is required.');
      return;
    }

    if (rows.length === 0) {
      setCalculationError('Add at least one ingredient before calculating.');
      return;
    }

    const newRows = rows.map((row) => {
      const match = ingredientMap.get(row.ingredientName.trim());
      if (!match) {
        return { ...row, error: 'Select an exact ingredient from the list.' };
      }
      if (row.quantity <= 0) {
        return { ...row, error: 'Quantity must be greater than 0.' };
      }
      return { ...row, error: undefined };
    });

    setRows(newRows);

    const invalid = newRows.some((row) => row.error);
    if (invalid) {
      setCalculationError('Please fix invalid ingredient entries.');
      return;
    }

    const totals: NutritionTotals = {};
    for (const k of nutrientKeys) totals[k] = 0;

    const ingredientsForExport = newRows.map((row) => {
      const ingredient = ingredientMap.get(row.ingredientName.trim())! as IngredientRecord;
      const factor = row.quantity / 100;
      for (const k of nutrientKeys) {
        const v = Number(ingredient[k] || 0);
        totals[k] = (totals[k] || 0) + v * factor;
      }

      return {
        name: ingredient.ingr_name,
        quantity: row.quantity,
        unit: row.unit,
        ingredientId: ingredient.ingr_id
      };
    });

    const ingredientWeightSum = newRows.reduce((sum, row) => sum + row.quantity, 0);
    const computedFinalWeight = finalWeight > 0 ? finalWeight : ingredientWeightSum;

    if (finalWeight > 0 && finalWeight > ingredientWeightSum) {
      setCalculationError('Final product weight cannot exceed the sum of ingredient weights.');
      return;
    }

    if (ingredientWeightSum <= 0) {
      setCalculationError('Ingredient quantities must sum to more than 0.');
      return;
    }

    const per100g: NutritionTotals = {};
    for (const k of nutrientKeys) {
      per100g[k] = (totals[k] / computedFinalWeight) * 100;
    }

    setFinalWeight(computedFinalWeight);

    const payload: ExportPayload = {
      productName: productName.trim(),
      finalWeight: computedFinalWeight,
      ingredients: ingredientsForExport,
      nutritionTotals: Object.fromEntries(
        Object.entries(totals).map(([k, v]) => [k, Number((v || 0).toFixed(4))])
      ),
      nutritionPer100g: Object.fromEntries(
        Object.entries(per100g).map(([k, v]) => [k, Number((v || 0).toFixed(4))])
      )
    };
    setReadyExportPayload(payload);
    setCanSave(true);
    setExportMessage('Calculation done. Click "Save" to save this label.');
  };

  const saveLabel = async () => {
    setExportMessage(null);
    if (!readyExportPayload || !canSave) {
      setExportMessage('Nothing to save. Run calculation first.');
      return;
    }

    try {
      const bodyToSend = editingFilename
        ? { ...readyExportPayload, originalFilename: editingFilename }
        : readyExportPayload;

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyToSend)
      });

      if (!response.ok) {
        const data = await response.json();
        setExportMessage(data.error || 'Failed to save label.');
        return;
      }

      const data = await response.json();
      setExportMessage(`✓ Saved as "${readyExportPayload.productName}"`);
      // Reset form after 2 seconds
      setCanSave(false);
      // refresh saved labels list and clear editing state
      loadSavedLabels();
      setEditingFilename(null);
      setTimeout(() => {
        setProductName('');
        setRows([emptyRow(1)]);
        setFinalWeight(0);
        setNutritionPer100g(null);
        setReadyExportPayload(null);
        setExportMessage(null);
      }, 2000);
    } catch (err) {
      setExportMessage('Failed to save label.');
    }
  };

  return (
    <main className="container">
      <section className="panel">
        <div className="header-row">
          <div>
            <h1>Nutrition Labels Generator</h1>
            <p>Build and manage product nutrition labels from local CIQUAL ingredient data.</p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="tabs">
          <button className={`tab ${currentView === 'new' ? 'active' : ''}`} onClick={() => setCurrentView('new')}>
            New Label
          </button>
          <button className={`tab ${currentView === 'saved' ? 'active' : ''}`} onClick={() => setCurrentView('saved')}>
            Saved Labels
          </button>
        </div>

        {/* New Label View */}
        {currentView === 'new' && (
          <div className="view-content">
            <label className="field-group">
              <span>Product Name</span>
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                placeholder="e.g. Strawberry Jam"
              />
              <span className="field-help">Choose a unique product name — it will be used as the identifier and filename when saving.</span>
            </label>

            <div className="ingredients-block">
              <div className="ingredients-header">
                <span>Ingredient</span>
                <span>Quantity (g)</span>
                <span aria-hidden="true"></span>
              </div>

              {rows.map((row, index) => (
                <div key={row.id} className="ingredient-row">
                  <div>
                    <span className="mobile-label">Ingredient</span>
                    <div className="ingredient-input">
                      <input
                        list="ingredients"
                        value={row.ingredientName}
                        onChange={(event) => updateRow(index, { ingredientName: event.target.value })}
                        placeholder="Type ingredient name"
                      />
                      <datalist id="ingredients">
                        {ingredientNames.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                      {row.error ? <p className="field-error">{row.error}</p> : null}
                    </div>
                  </div>

                  <div>
                    <span className="mobile-label">Quantity</span>
                    <div className="quantity-with-unit">
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(event) => updateRow(index, { quantity: sanitizeNumericInput(event.target.value) })}
                      />
                      <span className="unit-suffix">g</span>
                    </div>
                  </div>

                  <div>
                    <span className="mobile-label" aria-hidden="true"></span>
                    <button type="button" className="remove-button" onClick={() => removeRow(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button type="button" className="ghost-button" onClick={addRow}>
                + Add Ingredient
              </button>
            </div>

            <div className="controls-row">
              <label className="field-group small-field">
                <span>Final Product Weight (g)</span>
                <input
                  type="number"
                  placeholder="0"
                  value={finalWeight}
                  onChange={(event) => setFinalWeight(sanitizeNumericInput(event.target.value))}
                />
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="primary-button" onClick={runCalculation}>
                  Calculate
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={saveLabel}
                  disabled={!canSave || productName.trim() === ''}
                >
                  Save
                </button>
              </div>
            </div>

            {calculationError ? <p className="alert">{calculationError}</p> : null}
            {exportMessage ? <p className="success">{exportMessage}</p> : null}

            {nutritionPer100g && (
              <section className="results">
                <div className="result-panel">
                  <h2>Ingredients</h2>
                  <ol>
                    {sortedIngredientRows.map((row) => (
                      <li key={row.id}>
                        {row.ingredientName} — {row.quantity} {row.unit}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="result-panel">
                  <h2>Nutrition per 100 g</h2>
                  <NutritionTable nutritionPer100g={nutritionPer100g} nutrientKeys={nutrientKeys} fatDetailsVisible={fatDetailsVisible} />
                </div>
              </section>
            )}
          </div>
        )}

        {/* Saved Labels View */}
        {currentView === 'saved' && (
          <div className="saved-labels-view">
            <div className="saved-labels-sidebar">
              <h3>Saved Labels</h3>
              {loadingLabels ? (
                <p style={{ color: '#999' }}>Loading...</p>
              ) : savedLabels.length === 0 ? (
                <p style={{ color: '#999' }}>No saved labels yet</p>
              ) : (
                <div className="labels-list">
                  {savedLabels.map((label) => (
                    <button
                      key={label.filename}
                      className={`label-item ${selectedLabel?.filename === label.filename ? 'active' : ''}`}
                      onClick={() => setSelectedLabel(label)}
                    >
                      {label.productName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="saved-labels-content">
              {selectedLabel ? (
                <>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ margin: 0 }}>{selectedLabel.productName}</h2>
                    <div>
                      <button type="button" className="ghost-button" onClick={() => loadLabelIntoForm(selectedLabel)}>
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="saved-results stacked">
                    <div className="result-panel">
                      <h3>Ingredients</h3>
                      <ol>
                        {selectedLabel.data.ingredients
                          .sort((a, b) => b.quantity - a.quantity)
                          .map((ing, idx) => (
                            <li key={idx}>
                              {ing.name} — {ing.quantity} {ing.unit}
                            </li>
                          ))}
                      </ol>
                    </div>

                    <div className="result-panel">
                      <h3>Nutrition per 100 g</h3>
                      <NutritionTable
                        nutritionPer100g={selectedLabel.data.nutritionPer100g}
                        nutrientKeys={nutrientKeys}
                        fatDetailsVisible={selectedLabelFatDetailsVisible}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ color: '#999' }}>Select a label to view</p>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
