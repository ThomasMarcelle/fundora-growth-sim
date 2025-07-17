import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, TrendingUp, PieChart, BarChart3, AlertTriangle, Edit, Info } from 'lucide-react';
import fundoraLogo from '@/assets/fundora-logo-real.png';

interface Parameters {
  investor_commitment: number;
  yearly_call: number;
  nb_call_years: number;
  reinvest_rate: number;
  target_tvpi: number;
  manual_calendar: boolean;
  gross_distributions: number[];
}

interface YearlyData {
  year: number;
  capital_call: number;
  gross_distribution: number;
  recycled_distribution: number;
  actual_cash_out: number;
  net_cash_flow: number;
  future_value_T10: number;
  outstanding_commitment_before_year: number;
}

interface FinalResults {
  capital_reel_verse: number;
  distributions_nettes: number;
  nav_finale: number;
  valeur_finale: number;
  moic: number;
  tri_annuel: number;
}

export default function InvestmentSimulator() {
  const [params, setParams] = useState<Parameters>({
    investor_commitment: 100000,
    yearly_call: 20000,
    nb_call_years: 5,
    reinvest_rate: 0.15,
    target_tvpi: 2.5,
    manual_calendar: false,
    gross_distributions: [0, 0, 0, 25000, 25000, 25000, 25000, 37500, 37500, 37500, 37500]
  });

  const [yearlyData, setYearlyData] = useState<YearlyData[]>([]);
  const [finalResults, setFinalResults] = useState<FinalResults>({
    capital_reel_verse: 0,
    distributions_nettes: 0,
    nav_finale: 0,
    valeur_finale: 0,
    moic: 0,
    tri_annuel: 0
  });

  // Calcul du recyclage et des flux
  const calculateSimulation = () => {
    const years: YearlyData[] = [];
    
    // Calcul pour chaque année (0 à 10)
    for (let year = 0; year <= 10; year++) {
      // Capital call = SI(year ≤ nb_call_years ; -yearly_call ; 0)
      const capital_call = year > 0 && year <= params.nb_call_years ? -params.yearly_call : 0;
      
      // Distribution brute (paramétrable)
      const gross_distribution = params.gross_distributions[year] || 0;
      
      // Calcul de l'engagement restant avant cette année
      let outstanding_commitment_before_year = params.investor_commitment;
      
      // Soustraction des appels précédents
      for (let prevYear = 1; prevYear < year; prevYear++) {
        const prevCapitalCall = prevYear <= params.nb_call_years ? -params.yearly_call : 0;
        outstanding_commitment_before_year += prevCapitalCall; // capital_call est négatif
      }
      
      // Soustraction des distributions recyclées précédentes
      for (let prevYear = 1; prevYear < year; prevYear++) {
        const prevYearData = years.find(y => y.year === prevYear);
        if (prevYearData) {
          outstanding_commitment_before_year -= prevYearData.recycled_distribution;
        }
      }
      
      // Distribution recyclée = MIN(gross_distribution, MIN(-capital_call, outstanding_commitment_before_year))
      let recycled_distribution = 0;
      if (outstanding_commitment_before_year > 0) {
        recycled_distribution = Math.min(
          gross_distribution,
          Math.min(-capital_call, outstanding_commitment_before_year)
        );
      }
      
      // Montant réel décaissé = capital_call + recycled_distribution
      const actual_cash_out = capital_call + recycled_distribution;
      
      // Flux net = gross_distribution - recycled_distribution + capital_call
      const net_cash_flow = gross_distribution - recycled_distribution + capital_call;
      
      // Valeur future à T10 = SI(net_cash_flow>0 ; (gross_distribution-recycled_distribution)×(1+reinvest_rate)^(10-year) ; 0)
      const future_value_T10 = net_cash_flow > 0 ? 
        (gross_distribution - recycled_distribution) * Math.pow(1 + params.reinvest_rate, 10 - year) : 0;
      
      years.push({
        year,
        capital_call,
        gross_distribution,
        recycled_distribution,
        actual_cash_out,
        net_cash_flow,
        future_value_T10,
        outstanding_commitment_before_year
      });
    }
    
    // Calcul des résultats finaux
    const capital_reel_verse = Math.abs(years.reduce((sum, y) => sum + y.actual_cash_out, 0));
    const distributions_nettes = years.reduce((sum, y) => sum + (y.gross_distribution - y.recycled_distribution), 0);
    const nav_finale = params.investor_commitment * params.target_tvpi - distributions_nettes;
    const valeur_finale = nav_finale + years.reduce((sum, y) => sum + y.future_value_T10, 0);
    const moic = capital_reel_verse > 0 ? valeur_finale / capital_reel_verse : 0;
    
    // Calcul du TRI (approximation avec les flux nets)
    const cashFlows = years.map(y => y.net_cash_flow);
    let tri_annuel = 0;
    try {
      // Méthode de Newton-Raphson simplifiée pour calculer le TRI
      const calculateNPV = (rate: number) => {
        return cashFlows.reduce((npv, cf, i) => npv + cf / Math.pow(1 + rate, i), 0);
      };
      
      let rate = 0.1; // Taux initial
      for (let i = 0; i < 100; i++) {
        const npv = calculateNPV(rate);
        const derivative = cashFlows.reduce((d, cf, i) => d - (i * cf) / Math.pow(1 + rate, i + 1), 0);
        if (Math.abs(derivative) < 1e-10) break;
        rate = rate - npv / derivative;
      }
      tri_annuel = rate;
    } catch (e) {
      tri_annuel = Math.pow(moic, 1/10) - 1; // Fallback
    }
    
    setYearlyData(years);
    setFinalResults({
      capital_reel_verse,
      distributions_nettes,
      nav_finale,
      valeur_finale,
      moic,
      tri_annuel
    });
  };

  useEffect(() => {
    calculateSimulation();
  }, [params]);

  const handleParamChange = (field: keyof Parameters, value: any) => {
    setParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDistributionChange = (year: number, value: number) => {
    const newDistributions = [...params.gross_distributions];
    newDistributions[year] = value;
    setParams(prev => ({
      ...prev,
      gross_distributions: newDistributions
    }));
  };

  const isOverCommitment = finalResults.capital_reel_verse > params.investor_commitment;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img src={fundoraLogo} alt="Fundora" className="w-16 h-16" />
            <h1 className="text-4xl font-bold text-white">Fundora</h1>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Scénario Fundora Plus</h2>
          <p className="text-slate-300 text-lg">
            Simulateur d'investissement LBO avec recyclage des distributions
          </p>
        </div>

        <Tabs defaultValue="simulation" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simulation">Simulation</TabsTrigger>
            <TabsTrigger value="explanations">Explications</TabsTrigger>
          </TabsList>

          <TabsContent value="simulation" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Paramètres */}
              <Card className="lg:col-span-1 bg-blue-50 border-2 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Calculator className="w-5 h-5" />
                    Paramètres
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Cellules bleues éditables
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="commitment" className="text-slate-900">Souscription de l'investisseur (€)</Label>
                    <Input
                      id="commitment"
                      type="number"
                      value={params.investor_commitment}
                      onChange={(e) => handleParamChange('investor_commitment', Number(e.target.value))}
                      className="bg-white border-blue-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yearly_call" className="text-slate-900">Montant appelé chaque année (€)</Label>
                    <Input
                      id="yearly_call"
                      type="number"
                      value={params.yearly_call}
                      onChange={(e) => handleParamChange('yearly_call', Number(e.target.value))}
                      className="bg-white border-blue-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nb_years" className="text-slate-900">Nombre d'années d'appels</Label>
                    <Input
                      id="nb_years"
                      type="number"
                      value={params.nb_call_years}
                      onChange={(e) => handleParamChange('nb_call_years', Number(e.target.value))}
                      className="bg-white border-blue-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reinvest" className="text-slate-900">Taux de réinvestissement annuel (%)</Label>
                    <Input
                      id="reinvest"
                      type="number"
                      step="0.1"
                      value={params.reinvest_rate * 100}
                      onChange={(e) => handleParamChange('reinvest_rate', Number(e.target.value) / 100)}
                      className="bg-white border-blue-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tvpi" className="text-slate-900">Multiple base cible (TVPI)</Label>
                    <Input
                      id="tvpi"
                      type="number"
                      step="0.1"
                      value={params.target_tvpi}
                      onChange={(e) => handleParamChange('target_tvpi', Number(e.target.value))}
                      className="bg-white border-blue-300"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="manual-calendar"
                      checked={params.manual_calendar}
                      onCheckedChange={(checked) => handleParamChange('manual_calendar', checked)}
                    />
                    <Label htmlFor="manual-calendar" className="text-slate-900">
                      Éditer le calendrier manuellement
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Résultats KPIs */}
              <div className="lg:col-span-3 space-y-8">
                {/* Alerte engagement */}
                {isOverCommitment && (
                  <Alert className="border-red-500 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      ⚠️ Attention : Capital réellement versé ({finalResults.capital_reel_verse.toLocaleString('fr-FR')} €) 
                      supérieur à l'engagement ({params.investor_commitment.toLocaleString('fr-FR')} €)
                    </AlertDescription>
                  </Alert>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-sm">Capital réellement versé</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-400">
                        {finalResults.capital_reel_verse.toLocaleString('fr-FR')} €
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-sm">Distributions nettes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-400">
                        {finalResults.distributions_nettes.toLocaleString('fr-FR')} €
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-sm">NAV finale</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-400">
                        {finalResults.nav_finale.toLocaleString('fr-FR')} €
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-sm">Valeur finale</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-400">
                        {finalResults.valeur_finale.toLocaleString('fr-FR')} €
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-sm">MOIC</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-400">
                        {finalResults.moic.toFixed(2)}×
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-sm">TRI annuel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-400">
                        {(finalResults.tri_annuel * 100).toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tableau principal */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Évolution annuelle</CardTitle>
                    <CardDescription className="text-slate-300">
                      Détail des flux par année avec recyclage
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-white">
                        <thead>
                          <tr className="border-b border-slate-600">
                            <th className="text-left p-3">Année</th>
                            <th className="text-right p-3">Capital Call</th>
                            <th className="text-right p-3">Distribution brute</th>
                            <th className="text-right p-3">Distribution recyclée</th>
                            <th className="text-right p-3">Montant réel décaissé</th>
                            <th className="text-right p-3">Flux Net</th>
                            <th className="text-right p-3">Valeur future à T10</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearlyData.map((year, index) => (
                            <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/50">
                              <td className="p-3 font-medium">{year.year}</td>
                              <td className="text-right p-3">
                                <span className={year.capital_call < 0 ? 'text-red-400' : 'text-slate-400'}>
                                  {year.capital_call !== 0 ? `${year.capital_call.toLocaleString('fr-FR')} €` : '-'}
                                </span>
                              </td>
                              <td className="text-right p-3">
                                {params.manual_calendar ? (
                                  <Input
                                    type="number"
                                    value={year.gross_distribution}
                                    onChange={(e) => handleDistributionChange(year.year, Number(e.target.value))}
                                    className="w-20 h-8 text-xs bg-blue-50 border-blue-300 text-slate-900"
                                  />
                                ) : (
                                  <span className={year.gross_distribution > 0 ? 'text-green-400' : 'text-slate-400'}>
                                    {year.gross_distribution > 0 ? `${year.gross_distribution.toLocaleString('fr-FR')} €` : '-'}
                                  </span>
                                )}
                              </td>
                              <td className="text-right p-3">
                                <span className={year.recycled_distribution > 0 ? 'text-yellow-400 italic' : 'text-slate-400'}>
                                  {year.recycled_distribution > 0 ? `${year.recycled_distribution.toLocaleString('fr-FR')} €` : '-'}
                                </span>
                              </td>
                              <td className="text-right p-3">
                                <span className={year.actual_cash_out > 0 ? 'text-green-400' : year.actual_cash_out < 0 ? 'text-red-400' : 'text-slate-400'}>
                                  {year.actual_cash_out !== 0 ? `${year.actual_cash_out.toLocaleString('fr-FR')} €` : '-'}
                                </span>
                              </td>
                              <td className="text-right p-3">
                                <span className={year.net_cash_flow > 0 ? 'text-green-400' : year.net_cash_flow < 0 ? 'text-red-400' : 'text-slate-400'}>
                                  {year.net_cash_flow !== 0 ? `${year.net_cash_flow.toLocaleString('fr-FR')} €` : '-'}
                                </span>
                              </td>
                              <td className="text-right p-3">
                                <span className={year.future_value_T10 > 0 ? 'text-blue-400' : 'text-slate-400'}>
                                  {year.future_value_T10 > 0 ? `${year.future_value_T10.toLocaleString('fr-FR')} €` : '-'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="explanations" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Explications Fundora Plus
                </CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300 space-y-4">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">🔹 ① Principe du recyclage</h3>
                  <p>Les distributions brutes sont automatiquement réinvesties dans le fonds tant que l'engagement initial n'est pas entièrement appelé.</p>
                  
                  <h3 className="text-lg font-semibold text-white">🔹 ② Formule de recyclage</h3>
                  <p className="font-mono text-sm bg-slate-700 p-2 rounded">
                    Distribution recyclée = MIN(Distribution brute, MIN(-Capital Call, Engagement restant))
                  </p>
                  
                  <h3 className="text-lg font-semibold text-white">🔹 ③ Calcul de l'engagement restant</h3>
                  <p className="font-mono text-sm bg-slate-700 p-2 rounded">
                    Engagement restant = Souscription - SOMME(Appels précédents) - SOMME(Recyclages précédents)
                  </p>
                  
                  <h3 className="text-lg font-semibold text-white">🔹 ④ Flux net</h3>
                  <p className="font-mono text-sm bg-slate-700 p-2 rounded">
                    Flux Net = Distribution brute - Distribution recyclée + Capital Call
                  </p>
                  
                  <h3 className="text-lg font-semibold text-white">🔹 ⑤ Valeur future</h3>
                  <p className="font-mono text-sm bg-slate-700 p-2 rounded">
                    Valeur future = (Distribution brute - Distribution recyclée) × (1 + Taux)^(10 - Année)
                  </p>
                  
                  <h3 className="text-lg font-semibold text-white">🔹 ⑥ NAV finale</h3>
                  <p className="font-mono text-sm bg-slate-700 p-2 rounded">
                    NAV finale = Souscription × TVPI cible - Distributions nettes
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}