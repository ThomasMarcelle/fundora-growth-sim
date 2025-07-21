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
    // Calcul des frais de plateforme selon les tranches
    const calculatePlatformFees = (montant: number, annee: number) => {
      if (montant < 30000) {
        // 0 à 29,999€ : 1,7% par an + 3% première année
        return annee === 1 ? montant * 0.03 : montant * 0.017;
      } else if (montant < 100000) {
        // 30,000 à 99,999€ : 2,5% première année + 1,5% par an
        return annee === 1 ? montant * 0.025 : montant * 0.015;
      } else {
        // 100,000€ et plus : 2% première année + 1,2% par an
        return annee === 1 ? montant * 0.02 : montant * 0.012;
      }
    };

    // Calcul du montant net après déduction de tous les frais sur 10 ans
    let fraisTotaux = 0;
    for (let i = 1; i <= 10; i++) {
      fraisTotaux += calculatePlatformFees(data.souscription, i);
    }
    const montantNetInvesti = data.souscription - fraisTotaux;

    let montantAppelAnnuel: number;
    let nombreAnneesDistribution: number;
    let anneeDebutDistribution: number;
    
    if (data.investmentType === 'vc') {
      montantAppelAnnuel = montantNetInvesti / 5;
      anneeDebutDistribution = 5;
      nombreAnneesDistribution = 6;
    } else if (data.investmentType === 'secondaire') {
      montantAppelAnnuel = montantNetInvesti / 2;
      anneeDebutDistribution = 2;
      nombreAnneesDistribution = 5;
    } else {
      montantAppelAnnuel = montantNetInvesti / data.nombreAnnees;
      anneeDebutDistribution = 4;
      nombreAnneesDistribution = 7; // années 4-7 (capital) + années 8-10 (profit) = 7 années
    }

    // Première passe : calculer le capital réel décaissé sans distributions
    const firstPassYears: YearlyData[] = [];
    let totalActualCashOutEstimate = 0;
    
    for (let i = 1; i <= 10; i++) {
      const year: YearlyData = {
        annee: i,
        capitalCall: 0,
        distribution: 0,
        distributionRecyclee: 0,
        montantRealDecaisse: 0,
        fluxNet: 0,
        valeurFuture: 0
      };

      // Capital call - Pour les montants < 30k, tout en année 1
      if (data.souscription < 30000) {
        if (i === 1) {
          year.capitalCall = -montantNetInvesti;
        }
      } else {
        // Logique normale pour les montants >= 30k
        if (data.investmentType === 'vc') {
          if (i <= 5) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else if (data.investmentType === 'secondaire') {
          if (i <= 2) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else {
          if (i <= data.nombreAnnees) {
            year.capitalCall = -montantAppelAnnuel;
          }
        }
      }

      // Pas de distributions dans cette passe d'estimation
      year.distribution = 0;
      year.distributionRecyclee = 0;
      year.montantRealDecaisse = year.capitalCall;
      
      totalActualCashOutEstimate += Math.abs(year.montantRealDecaisse);
      firstPassYears.push(year);
    }

    // Maintenant calculer les vraies distributions basées sur le capital réel décaissé
    let valeurTotaleDistributions: number;
    if (data.investmentType === 'vc') {
      valeurTotaleDistributions = totalActualCashOutEstimate * 4; // MOIC de 4
    } else if (data.investmentType === 'secondaire') {
      valeurTotaleDistributions = totalActualCashOutEstimate * 2.2; // MOIC de 2.2
    } else {
      valeurTotaleDistributions = totalActualCashOutEstimate * 2.5; // MOIC de 2.5
    }

    // Deuxième passe : calcul final avec les vraies distributions linéaires
    const years: YearlyData[] = [];
    let totalCapitalCalled = 0;
    let totalActualCashOut = 0;

    for (let i = 1; i <= 10; i++) {
      const year: YearlyData = {
        annee: i,
        capitalCall: 0,
        distribution: 0,
        distributionRecyclee: 0,
        montantRealDecaisse: 0,
        fluxNet: 0,
        valeurFuture: 0
      };

      // Capital call - Pour les montants < 30k, tout en année 1
      if (data.souscription < 30000) {
        if (i === 1) {
          year.capitalCall = -montantNetInvesti;
        }
      } else {
        // Logique normale pour les montants >= 30k
        if (data.investmentType === 'vc') {
          if (i <= 5) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else if (data.investmentType === 'secondaire') {
          if (i <= 2) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else {
          if (i <= data.nombreAnnees) {
            year.capitalCall = -montantAppelAnnuel;
          }
        }
      }

      // Distributions linéaires croissantes pour toutes les stratégies
      if (data.investmentType === 'vc') {
        // VC : distributions linéaires croissantes années 5-10
        if (i >= 5 && i <= 10) {
          const anneeDistribution = i - 5 + 1; // 1, 2, 3, 4, 5, 6
          const totalAnneesDistrib = nombreAnneesDistribution; // 6
          // Distribution croissante : année 1 = plus petit, année 6 = plus grand
          const facteurCroissance = (2 * anneeDistribution) / (totalAnneesDistrib + 1);
          year.distribution = (valeurTotaleDistributions / totalAnneesDistrib) * facteurCroissance;
        }
      } else if (data.investmentType === 'secondaire') {
        // Secondaire : distributions linéaires croissantes années 2-6
        if (i >= 2 && i <= 6) {
          const anneeDistribution = i - 2 + 1; // 1, 2, 3, 4, 5
          const totalAnneesDistrib = nombreAnneesDistribution; // 5
          const facteurCroissance = (2 * anneeDistribution) / (totalAnneesDistrib + 1);
          year.distribution = (valeurTotaleDistributions / totalAnneesDistrib) * facteurCroissance;
        }
      } else {
        // LBO : montant net investi rendu années 4-7 (croissant), puis profit années 8-10 (croissant)
        if (i >= 4 && i <= 7) {
          // Rendre le montant net investi de manière croissante sur 4 années (4, 5, 6, 7)
          const anneeDistribution = i - 4 + 1; // 1, 2, 3, 4
          const facteurCroissance = (2 * anneeDistribution) / (4 + 1); // facteur croissant
          year.distribution = (montantNetInvesti / 4) * facteurCroissance;
        } else if (i >= 8 && i <= 10) {
          // Profit distribué de manière croissante en 3 années (8, 9, 10)
          const profitTotal = valeurTotaleDistributions - montantNetInvesti;
          const anneeDistribution = i - 8 + 1; // 1, 2, 3
          const facteurCroissance = (2 * anneeDistribution) / (3 + 1); // facteur croissant
          year.distribution = (profitTotal / 3) * facteurCroissance;
        }
      }

      // Calcul du recyclage
      const capitalDejaAppele = years.reduce((sum, prevYear) => {
        return sum + Math.abs(prevYear.capitalCall) + prevYear.distributionRecyclee;
      }, 0);
      
      const commitmentRestant = Math.max(0, data.souscription - capitalDejaAppele);

      if (year.distribution > 0 && year.capitalCall < 0) {
        const capitalCallCetteAnnee = Math.abs(year.capitalCall);
        const recyclageNecessaire = Math.min(year.distribution, capitalCallCetteAnnee);
        year.distributionRecyclee = recyclageNecessaire;
      } else if (year.distribution > 0 && commitmentRestant > 0) {
        const recyclageNecessaire = Math.min(year.distribution, commitmentRestant);
        year.distributionRecyclee = recyclageNecessaire;
      }

      // Calcul des frais de plateforme pour cette année (seulement si capital call ou recyclage)
      const fraisCetteAnnee = (year.capitalCall < 0 || year.distributionRecyclee > 0) 
        ? -calculatePlatformFees(data.souscription, i)  // Négatif car c'est un coût
        : 0;
      
      // Le montant réel décaissé inclut les frais de plateforme seulement si nécessaire
      year.montantRealDecaisse = year.capitalCall + year.distributionRecyclee + fraisCetteAnnee;
      year.fluxNet = year.distribution - year.distributionRecyclee + year.capitalCall;

      const distributionNette = year.distribution - year.distributionRecyclee;
      if (distributionNette > 0) {
        const anneesRestantes = 10 - i;
        year.valeurFuture = distributionNette * Math.pow(1 + data.tauxReinvestissement, anneesRestantes);
      }

      totalCapitalCalled += Math.abs(year.capitalCall);
      totalActualCashOut += Math.abs(year.montantRealDecaisse);
      years.push(year);
    }

    // Calcul des résultats finaux (les frais sont déjà inclus dans montantRealDecaisse)
    const valeurFinaleReinvestie = years.reduce((sum, year) => sum + year.valeurFuture, 0);
    const moic = valeurFinaleReinvestie / totalActualCashOut;
    const triAnnuel = Math.pow(moic, 1/10) - 1;

    setResults(years);
    setFinalResults({
      capitalTotalRealInvesti: totalCapitalCalled,
      capitalRealInvesti: totalActualCashOut,
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-fit">
            {/* Formulaire - Colonne de gauche */}
            <div className="space-y-6 h-fit">
              <div className="box h-fit">
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
                          checked={data.investmentType === 'secondaire'}
                          onChange={() => handleInvestmentTypeChange('secondaire')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="secondaire" className="text-sm">Secondaire</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Résultats - Colonne de droite */}
            <div className="space-y-6 h-fit">
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
                       <p>Total Value to Paid-In capital : ratio entre la valeur finale et le capital réel investi. Indique combien de fois votre investissement initial a été multiplié.</p>
                     </TooltipContent>
                   </Tooltip>
                   <div className="big-number text-xl font-bold">
                     {finalResults.moic.toFixed(2)}x
                   </div>
                   <p className="text text-sm mt-1">TVPI</p>
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