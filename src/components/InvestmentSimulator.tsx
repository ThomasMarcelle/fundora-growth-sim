import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator, TrendingUp, PieChart, BarChart3 } from 'lucide-react';
import fundoraLogo from '@/assets/fundora-logo.png';

interface SimulationData {
  souscription: number;
  montantAppelAnnuel: number;
  nombreAnnees: number;
  anneeDebutDistribution: number;
  nombreAnneesDistribution: number;
  multipleBaseCible: number;
  tauxReinvestissement: number;
}

interface YearlyData {
  annee: number;
  capitalCall: number;
  distribution: number;
  montantRealDecaisse: number;
  distributionAppelePondere: number;
  montantAppeleFonds: number;
  valeurFuture: number;
}

export default function InvestmentSimulator() {
  const [data, setData] = useState<SimulationData>({
    souscription: 100000,
    montantAppelAnnuel: 20000,
    nombreAnnees: 5,
    anneeDebutDistribution: 3,
    nombreAnneesDistribution: 4,
    multipleBaseCible: 2.5,
    tauxReinvestissement: 0.15
  });

  const [results, setResults] = useState<YearlyData[]>([]);
  const [finalResults, setFinalResults] = useState({
    capitalTotalRealInvesti: 0,
    valeurFinaleReinvestie: 0,
    moic: 0,
    triAnnuel: 0
  });

  const calculateSimulation = () => {
    const years: YearlyData[] = [];
    let cumulativeCapitalCall = 0;
    let cumulativeDistribution = 0;

    // Calcul pour chaque année (0 à 10)
    for (let i = 0; i <= 10; i++) {
      const year: YearlyData = {
        annee: i,
        capitalCall: 0,
        distribution: 0,
        montantRealDecaisse: 0,
        distributionAppelePondere: 0,
        montantAppeleFonds: 0,
        valeurFuture: 0
      };

      // Capital call pendant les années d'appel
      if (i > 0 && i <= data.nombreAnnees) {
        year.capitalCall = -data.montantAppelAnnuel;
        cumulativeCapitalCall += data.montantAppelAnnuel;
      }

      // Distributions pendant les années de distribution
      if (i >= data.anneeDebutDistribution && i < data.anneeDebutDistribution + data.nombreAnneesDistribution) {
        const distributionAnnuelle = (data.souscription * data.multipleBaseCible) / data.nombreAnneesDistribution;
        year.distribution = distributionAnnuelle;
        cumulativeDistribution += distributionAnnuelle;
      }

      // Montant réel décaissé
      year.montantRealDecaisse = year.capitalCall + year.distribution;

      // Distribution appelée pondérée par le fonds
      year.distributionAppelePondere = year.distribution;

      // Montant appelé par le fonds à la place du capital
      year.montantAppeleFonds = year.capitalCall ? Math.abs(year.capitalCall) : 0;

      // Valeur future (réinvestissement)
      if (year.distribution > 0) {
        const anneesRestantes = 10 - i;
        year.valeurFuture = year.distribution * Math.pow(1 + data.tauxReinvestissement, anneesRestantes);
      }

      years.push(year);
    }

    // Calcul des résultats finaux
    const capitalTotalRealInvesti = cumulativeCapitalCall;
    const valeurFinaleReinvestie = years.reduce((sum, year) => sum + year.valeurFuture, 0);
    const moic = valeurFinaleReinvestie / capitalTotalRealInvesti;
    
    // Calcul du TRI (approximation)
    const triAnnuel = Math.pow(moic, 1/10) - 1;

    setResults(years);
    setFinalResults({
      capitalTotalRealInvesti,
      valeurFinaleReinvestie,
      moic,
      triAnnuel
    });
  };

  useEffect(() => {
    calculateSimulation();
  }, [data]);

  const handleInputChange = (field: keyof SimulationData, value: number) => {
    setData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img src={fundoraLogo} alt="Fundora" className="w-12 h-12" />
            <h1 className="text-4xl font-bold text-white">Fundora</h1>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Simulateur d'Investissement</h2>
          <p className="text-primary-foreground/80 text-lg">
            Les fonds de private equity accessibles dès 100€
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Paramètres */}
          <Card className="lg:col-span-1 shadow-fundora">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Paramètres
              </CardTitle>
              <CardDescription>
                Configurez votre simulation d'investissement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="souscription">Souscription de l'investisseur (€)</Label>
                <Input
                  id="souscription"
                  type="number"
                  value={data.souscription}
                  onChange={(e) => handleInputChange('souscription', Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="montantAppel">Montant appelé chaque année (€)</Label>
                <Input
                  id="montantAppel"
                  type="number"
                  value={data.montantAppelAnnuel}
                  onChange={(e) => handleInputChange('montantAppelAnnuel', Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombreAnnees">Nombre d'années d'appels</Label>
                <Input
                  id="nombreAnnees"
                  type="number"
                  value={data.nombreAnnees}
                  onChange={(e) => handleInputChange('nombreAnnees', Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="anneeDebut">Année de début des distributions</Label>
                <Input
                  id="anneeDebut"
                  type="number"
                  value={data.anneeDebutDistribution}
                  onChange={(e) => handleInputChange('anneeDebutDistribution', Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="anneesDistrib">Nombre d'années de distributions</Label>
                <Input
                  id="anneesDistrib"
                  type="number"
                  value={data.nombreAnneesDistribution}
                  onChange={(e) => handleInputChange('nombreAnneesDistribution', Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="multiple">Multiple base cible</Label>
                <Input
                  id="multiple"
                  type="number"
                  step="0.1"
                  value={data.multipleBaseCible}
                  onChange={(e) => handleInputChange('multipleBaseCible', Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taux">Taux de réinvestissement (%)</Label>
                <Input
                  id="taux"
                  type="number"
                  step="0.01"
                  value={data.tauxReinvestissement * 100}
                  onChange={(e) => handleInputChange('tauxReinvestissement', Number(e.target.value) / 100)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Résultats */}
          <div className="lg:col-span-2 space-y-8">
            {/* Résultats clés */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-fundora">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Capital investi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {finalResults.capitalTotalRealInvesti.toLocaleString('fr-FR')} €
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-fundora">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Valeur finale
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {finalResults.valeurFinaleReinvestie.toLocaleString('fr-FR')} €
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-fundora">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    MOIC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {finalResults.moic.toFixed(2)}x
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-fundora">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    TRI Annuel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {(finalResults.triAnnuel * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tableau détaillé */}
            <Card className="shadow-fundora">
              <CardHeader>
                <CardTitle>Évolution annuelle</CardTitle>
                <CardDescription>
                  Détail des flux de trésorerie par année
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Année</th>
                        <th className="text-right p-2">Capital Call</th>
                        <th className="text-right p-2">Distribution</th>
                        <th className="text-right p-2">Flux Net</th>
                        <th className="text-right p-2">Valeur Future</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((year, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{year.annee}</td>
                          <td className="text-right p-2 text-destructive">
                            {year.capitalCall < 0 ? `${year.capitalCall.toLocaleString('fr-FR')} €` : '-'}
                          </td>
                          <td className="text-right p-2 text-green-600">
                            {year.distribution > 0 ? `${year.distribution.toLocaleString('fr-FR')} €` : '-'}
                          </td>
                          <td className="text-right p-2">
                            {year.montantRealDecaisse.toLocaleString('fr-FR')} €
                          </td>
                          <td className="text-right p-2 text-primary">
                            {year.valeurFuture > 0 ? `${year.valeurFuture.toLocaleString('fr-FR')} €` : '-'}
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
      </div>
    </div>
  );
}