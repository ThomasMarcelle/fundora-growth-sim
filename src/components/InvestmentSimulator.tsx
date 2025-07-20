import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calculator, TrendingUp, PieChart, BarChart3, Info, Recycle, Wallet, Target } from 'lucide-react';
import fundoraLogo from '@/assets/fundora-logo-official.png';

interface SimulationData {
  souscription: number;
  nombreAnnees: number;
  multipleBaseCible: number;
  tauxReinvestissement: number;
  investmentType: 'lbo' | 'vc' | 'secondaire';
}

interface YearlyData {
  annee: number;
  capitalCall: number;
  distribution: number;
  distributionRecyclee: number;
  montantRealDecaisse: number;
  fluxNet: number;
  valeurFuture: number;
}

export default function InvestmentSimulator() {
  const [data, setData] = useState<SimulationData>({
    souscription: 100000,
    nombreAnnees: 5,
    multipleBaseCible: 2.5,
    tauxReinvestissement: 0.15,
    investmentType: 'lbo'
  });

  const [results, setResults] = useState<YearlyData[]>([]);
  const [finalResults, setFinalResults] = useState({
    capitalTotalRealInvesti: 0,
    capitalRealInvesti: 0,
    valeurFinaleReinvestie: 0,
    moic: 0,
    triAnnuel: 0
  });

  const calculateSimulation = () => {
    const years: YearlyData[] = [];
    let totalCapitalCalled = 0;
    let totalActualCashOut = 0;
    
    let montantAppelAnnuel: number;
    let valeurTotaleDistribution: number;
    let nombreAnneesDistribution: number;
    let anneeDebutDistribution: number;
    
    if (data.investmentType === 'vc') {
      // VC : MOIC de 4, distributions linéaires croissantes à partir de l'année 5, cash décaissé sur 5 ans
      montantAppelAnnuel = data.souscription / 5; // 5 années d'appel
      valeurTotaleDistribution = data.souscription * 4; // MOIC de 4
      anneeDebutDistribution = 5;
      nombreAnneesDistribution = 6; // de l'année 5 à 10 = 6 années
    } else {
      // LBO : paramètres existants
      montantAppelAnnuel = data.souscription / data.nombreAnnees;
      valeurTotaleDistribution = data.souscription * data.multipleBaseCible;
      anneeDebutDistribution = 3;
      nombreAnneesDistribution = 8; // Capital (années 3-6) + Profit (années 7-10)
    }
    
    const distributionParAnnee = valeurTotaleDistribution / nombreAnneesDistribution;

    // Calcul pour chaque année (0 à 10)
    for (let i = 0; i <= 10; i++) {
      const year: YearlyData = {
        annee: i,
        capitalCall: 0,
        distribution: 0,
        distributionRecyclee: 0,
        montantRealDecaisse: 0,
        fluxNet: 0,
        valeurFuture: 0
      };

      // Capital call
      if (data.investmentType === 'vc') {
        // VC : cash décaissé sur 5 ans
        if (i > 0 && i <= 5) {
          year.capitalCall = -montantAppelAnnuel;
        }
      } else {
        // LBO : pendant les années d'appel définies
        if (i > 0 && i <= data.nombreAnnees) {
          year.capitalCall = -montantAppelAnnuel;
        }
      }

      // Distributions
      if (data.investmentType === 'vc') {
        // VC : distributions linéaires croissantes à partir de l'année 5
        if (i >= 5 && i <= 10) {
          // Progression linéaire croissante : distribution augmente chaque année
          const facteurCroissance = (i - 5 + 1) / nombreAnneesDistribution; // de 1/6 à 6/6
          const baseDistribution = valeurTotaleDistribution / nombreAnneesDistribution;
          year.distribution = baseDistribution * (0.5 + 1.5 * facteurCroissance); // Distribution croissante de 50% à 150% de la base
        }
      } else {
        // LBO : Capital rendu années 3-6, puis profit années 7-10
        const capitalARendreParAnnee = data.souscription / 4; // 4 années (3,4,5,6)
        const profitTotal = valeurTotaleDistribution - data.souscription;
        const profitParAnnee = profitTotal / 4; // 4 années (7,8,9,10)
        
        if (i >= 3 && i <= 6) {
          year.distribution = capitalARendreParAnnee;
        } else if (i >= 7 && i <= 10) {
          year.distribution = profitParAnnee;
        }
      }

      // Calcul du commitment restant avant cette année
      const capitalDejaAppele = years.slice(0, i).reduce((sum, prevYear) => {
        return sum + Math.abs(prevYear.capitalCall) + prevYear.distributionRecyclee;
      }, 0);
      
      const commitmentRestant = Math.max(0, data.souscription - capitalDejaAppele);

      // Distribution recyclée (utilisée pour financer le commitment)
      if (year.distribution > 0 && year.capitalCall < 0) {
        // En cas de capital call et distribution simultanés, on recycle pour réduire le cash à décaisser
        const capitalCallCetteAnnee = Math.abs(year.capitalCall);
        const recyclageNecessaire = Math.min(year.distribution, capitalCallCetteAnnee);
        year.distributionRecyclee = recyclageNecessaire;
      } else if (year.distribution > 0 && commitmentRestant > 0) {
        // Sinon, on recycle pour financer les futurs capital calls selon le commitment restant
        const recyclageNecessaire = Math.min(year.distribution, commitmentRestant);
        year.distributionRecyclee = recyclageNecessaire;
      }

      // Montant réel décaissé (cash effectivement sorti de poche)
      year.montantRealDecaisse = year.capitalCall + year.distributionRecyclee;

      // Flux net (pour calcul TRI)
      year.fluxNet = year.distribution - year.distributionRecyclee + year.capitalCall;

      // Valeur future (réinvestissement des distributions nettes)
      const distributionNette = year.distribution - year.distributionRecyclee;
      if (distributionNette > 0) {
        const anneesRestantes = 10 - i;
        year.valeurFuture = distributionNette * Math.pow(1 + data.tauxReinvestissement, anneesRestantes);
      }

      totalCapitalCalled += Math.abs(year.capitalCall);
      totalActualCashOut += Math.abs(year.montantRealDecaisse);

      years.push(year);
    }

    // Calcul des résultats finaux
    const capitalRealInvesti = totalActualCashOut;
    const valeurFinaleReinvestie = years.reduce((sum, year) => sum + year.valeurFuture, 0);
    const moic = valeurFinaleReinvestie / capitalRealInvesti;
    
    // Calcul du TRI (approximation)
    const triAnnuel = Math.pow(moic, 1/10) - 1;

    setResults(years);
    setFinalResults({
      capitalTotalRealInvesti: totalCapitalCalled,
      capitalRealInvesti,
      valeurFinaleReinvestie,
      moic,
      triAnnuel
    });
  };

  useEffect(() => {
    calculateSimulation();
  }, [data]);

  const handleInputChange = (field: keyof SimulationData, value: number | string) => {
    setData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInvestmentTypeChange = (type: 'lbo' | 'vc' | 'secondaire') => {
    setData(prev => ({
      ...prev,
      investmentType: type
    }));
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-background">
        <div className="main-container container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Formulaire - Colonne de gauche */}
            <div className="space-y-6">
              <div className="box">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="souscription">Souscription (€)</Label>
                    <Input
                      id="souscription"
                      type="number"
                      value={data.souscription}
                      onChange={(e) => handleInputChange('souscription', Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Type d'investissement</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="lbo"
                          name="investment-type"
                          value="lbo"
                          checked={data.investmentType === 'lbo'}
                          onChange={() => handleInvestmentTypeChange('lbo')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="lbo" className="text-sm">LBO</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="vc"
                          name="investment-type"
                          value="vc"
                          checked={data.investmentType === 'vc'}
                          onChange={() => handleInvestmentTypeChange('vc')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="vc" className="text-sm">VC</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="secondaire"
                          name="investment-type"
                          value="secondaire"
                          disabled
                          className="w-4 h-4 text-primary border-border focus:ring-primary opacity-50"
                        />
                        <Label htmlFor="secondaire" className="text-sm opacity-50">Secondaire</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Résultats - Colonne de droite */}
            <div className="space-y-6">
              {/* Résultats clés */}
              <div className="grid grid-cols-2 gap-4">
                <div className="box relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Montant réellement décaissé de votre poche. Grâce au recyclage des distributions, ce montant est inférieur à votre souscription initiale car une partie des distributions retournent dans le fonds.</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="big-number text-xl font-bold">
                    {finalResults.capitalRealInvesti.toLocaleString('fr-FR')} €
                  </div>
                  <p className="text text-sm mt-1">Capital réel investi</p>
                </div>

                <div className="box relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Valeur totale de votre investissement à la fin de la période, incluant le réinvestissement des distributions nettes au taux de 15% annuel.</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="big-number text-xl font-bold">
                    {finalResults.valeurFinaleReinvestie.toLocaleString('fr-FR')} €
                  </div>
                  <p className="text text-sm mt-1">Valeur finale</p>
                </div>

                <div className="box relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Multiple on Invested Capital : ratio entre la valeur finale et le capital réel investi. Indique combien de fois votre investissement initial a été multiplié.</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="big-number text-xl font-bold">
                    {finalResults.moic.toFixed(2)}x
                  </div>
                  <p className="text text-sm mt-1">MOIC</p>
                </div>

                <div className="box relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Taux de Rendement Interne annualisé de votre investissement sur 10 ans, tenant compte du recyclage des distributions.</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="big-number text-xl font-bold">
                    {(finalResults.triAnnuel * 100).toFixed(1)}%
                  </div>
                  <p className="text text-sm mt-1">TRI Annuel</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau en bas */}
          <div className="mt-8">
            <div className="box">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Année</th>
                      <th className="text-right p-2 flex items-center justify-end gap-1">
                        Capital Call
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Montant appelé par le fonds chaque année</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right p-2">Distribution</th>
                      <th className="text-right p-2">
                        Distrib. Recyclée
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help ml-1" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Partie des distributions qui retourne automatiquement dans le fonds pour financer les futurs capital calls, réduisant votre cash réel à décaisser.</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right p-2">Cash Décaissé</th>
                      <th className="text-right p-2">
                        Valeur Future
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help ml-1" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Valeur de la distribution nette réinvestie à 15% annuel jusqu'à l'année 10. Représente la croissance de votre cash libre grâce au réinvestissement.</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((year, index) => (
                      <tr key={index} className="border-b border-border hover:bg-muted/50">
                        <td className="p-2 font-medium">{year.annee}</td>
                        <td className="text-right p-2 text-red-400">
                          {year.capitalCall < 0 ? `${year.capitalCall.toLocaleString('fr-FR')} €` : '-'}
                        </td>
                        <td className="text-right p-2 text-green-400">
                          {year.distribution > 0 ? `${year.distribution.toLocaleString('fr-FR')} €` : '-'}
                        </td>
                        <td className="text-right p-2 text-blue-400 italic">
                          {year.distributionRecyclee > 0 ? `${year.distributionRecyclee.toLocaleString('fr-FR')} €` : '-'}
                        </td>
                        <td className="text-right p-2 font-medium">
                          <span className={year.montantRealDecaisse > 0 ? 'text-green-400' : year.montantRealDecaisse < 0 ? 'text-red-400' : ''}>
                            {year.montantRealDecaisse.toLocaleString('fr-FR')} €
                          </span>
                        </td>
                        <td className="text-right p-2 text-primary">
                          {year.valeurFuture > 0 ? `${year.valeurFuture.toLocaleString('fr-FR')} €` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}