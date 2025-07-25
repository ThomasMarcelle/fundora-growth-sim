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
  investmentType: 'BUYOUT' | 'VENTURE_CAPITAL' | 'SECONDARY' | 'GROWTH_CAPITAL' | 'DEBT';
  moicCible: number;
  rendementCible: number; // Pour la dette (en %)
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
    investmentType: 'BUYOUT',
    moicCible: 2.5,
    rendementCible: 11 // 11% pour la dette
  });

  const [results, setResults] = useState<YearlyData[]>([]);
  const [finalResults, setFinalResults] = useState({
    capitalTotalRealInvesti: 0,
    capitalRealInvesti: 0,
    valeurFinaleReinvestie: 0,
    moic: 0,
    triAnnuel: 0,
    fraisTotaux: 0
  });

  const calculateSimulation = () => {
    // Calcul des frais de plateforme selon les tranches
    const calculatePlatformFees = (montant: number, annee: number) => {
      if (montant < 30000) {
        // 0 à 29,999€ : 1,7% tous les ans + 3% première année seulement
        const fraisAnnuels = montant * 0.017;
        const fraisPremièreAnnée = annee === 1 ? montant * 0.03 : 0;
        return fraisAnnuels + fraisPremièreAnnée;
      } else if (montant < 100000) {
        // 30,000 à 99,999€ : 1,5% tous les ans + 2,5% première année seulement
        const fraisAnnuels = montant * 0.015;
        const fraisPremièreAnnée = annee === 1 ? montant * 0.025 : 0;
        return fraisAnnuels + fraisPremièreAnnée;
      } else {
        // 100,000€ et plus : 1,2% tous les ans + 2% première année seulement
        const fraisAnnuels = montant * 0.012;
        const fraisPremièreAnnée = annee === 1 ? montant * 0.02 : 0;
        return fraisAnnuels + fraisPremièreAnnée;
      }
    };

    // Calcul des frais totaux (seront déduits à la fin)
    let fraisTotaux = 0;
    for (let i = 1; i <= 10; i++) {
      fraisTotaux += calculatePlatformFees(data.souscription, i);
    }
    const montantNetInvesti = data.souscription; // Tout est investi, frais déduits à la fin

    let montantAppelAnnuel: number;
    let nombreAnneesDistribution: number;
    let anneeDebutDistribution: number;
    
    if (data.investmentType === 'VENTURE_CAPITAL') {
      montantAppelAnnuel = montantNetInvesti / 5;
      anneeDebutDistribution = 5;
      nombreAnneesDistribution = 6;
    } else if (data.investmentType === 'GROWTH_CAPITAL') {
      montantAppelAnnuel = montantNetInvesti / 5;
      anneeDebutDistribution = 4; // distributions commencent en année 4
      nombreAnneesDistribution = 7; // années 4-10
    } else if (data.investmentType === 'SECONDARY') {
      montantAppelAnnuel = montantNetInvesti / 2;
      anneeDebutDistribution = 2;
      nombreAnneesDistribution = 5;
    } else if (data.investmentType === 'DEBT') {
      // Pour la dette: capital call sur 4 ans avec répartition spécifique
      montantAppelAnnuel = 0; // sera calculé spécialement
      anneeDebutDistribution = 1; // coupons dès la première année
      nombreAnneesDistribution = 8; // coupons sur 8 ans
    } else { // BUYOUT
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
        if (data.investmentType === 'VENTURE_CAPITAL') {
          if (i <= 5) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else if (data.investmentType === 'GROWTH_CAPITAL') {
          if (i <= 5) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else if (data.investmentType === 'SECONDARY') {
          if (i <= 2) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else if (data.investmentType === 'DEBT') {
          // Capital call pour la dette selon le modèle du tableau
          if (i === 1) year.capitalCall = -montantNetInvesti * 0.55; // 55%
          else if (i === 2) year.capitalCall = -montantNetInvesti * 0.15; // 15%
          else if (i === 3) year.capitalCall = -montantNetInvesti * 0.20; // 20%
          else if (i === 4) year.capitalCall = -montantNetInvesti * 0.10; // 10%
        } else { // BUYOUT
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
    if (data.investmentType === 'DEBT') {
      // Pour la dette, pas de MOIC mais rendement annuel + remboursement du capital
      valeurTotaleDistributions = 0; // sera calculé différemment
    } else {
      valeurTotaleDistributions = totalActualCashOutEstimate * data.moicCible;
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
        if (data.investmentType === 'VENTURE_CAPITAL') {
          if (i <= 5) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else if (data.investmentType === 'GROWTH_CAPITAL') {
          if (i <= 5) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else if (data.investmentType === 'SECONDARY') {
          if (i <= 2) {
            year.capitalCall = -montantAppelAnnuel;
          }
        } else if (data.investmentType === 'DEBT') {
          // Capital call pour la dette selon le modèle du tableau
          if (i === 1) year.capitalCall = -montantNetInvesti * 0.55; // 55%
          else if (i === 2) year.capitalCall = -montantNetInvesti * 0.15; // 15%
          else if (i === 3) year.capitalCall = -montantNetInvesti * 0.20; // 20%
          else if (i === 4) year.capitalCall = -montantNetInvesti * 0.10; // 10%
        } else { // BUYOUT
          if (i <= data.nombreAnnees) {
            year.capitalCall = -montantAppelAnnuel;
          }
        }
      }

      // Distributions selon la stratégie
      if (data.investmentType === 'DEBT') {
        // Logique spéciale pour la dette : coupons + remboursement du capital
        const capitalCumuléJusquIci = years.slice(0, i).reduce((sum, prevYear) => 
          sum + Math.abs(prevYear.capitalCall), 0
        ) + Math.abs(year.capitalCall);
        
        // Coupons annuels sur le capital déjà appelé
        const couponAnnuel = capitalCumuléJusquIci * (data.rendementCible / 100);
        
        // Remboursement du capital sur les années 5-8
        let remboursementCapital = 0;
        if (i >= 5 && i <= 8) {
          // Rembourser 25% du capital chaque année sur 4 ans
          remboursementCapital = totalActualCashOutEstimate * 0.25;
        }
        
        year.distribution = couponAnnuel + remboursementCapital;
        
      } else if (data.investmentType === 'VENTURE_CAPITAL') {
        // VC : distributions linéaires croissantes années 5-10
        if (i >= 5 && i <= 10) {
          const anneeDistribution = i - 5 + 1; // 1, 2, 3, 4, 5, 6
          const totalAnneesDistrib = nombreAnneesDistribution; // 6
          // Distribution croissante : année 1 = plus petit, année 6 = plus grand
          const facteurCroissance = (2 * anneeDistribution) / (totalAnneesDistrib + 1);
          year.distribution = (valeurTotaleDistributions / totalAnneesDistrib) * facteurCroissance;
        }
      } else if (data.investmentType === 'GROWTH_CAPITAL') {
        // Growth Capital : distributions linéaires croissantes années 4-10 (comme VC mais 1 an plus tôt)
        if (i >= 4 && i <= 10) {
          const anneeDistribution = i - 4 + 1; // 1, 2, 3, 4, 5, 6, 7
          const totalAnneesDistrib = nombreAnneesDistribution; // 7
          const facteurCroissance = (2 * anneeDistribution) / (totalAnneesDistrib + 1);
          year.distribution = (valeurTotaleDistributions / totalAnneesDistrib) * facteurCroissance;
        }
      } else if (data.investmentType === 'SECONDARY') {
        // Secondaire : distributions linéaires croissantes années 2-6
        if (i >= 2 && i <= 6) {
          const anneeDistribution = i - 2 + 1; // 1, 2, 3, 4, 5
          const totalAnneesDistrib = nombreAnneesDistribution; // 5
          const facteurCroissance = (2 * anneeDistribution) / (totalAnneesDistrib + 1);
          year.distribution = (valeurTotaleDistributions / totalAnneesDistrib) * facteurCroissance;
        }
      } else { // BUYOUT
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

      // Calcul du recyclage - seulement si capital call ET distribution la même année
      const capitalDejaAppele = years.reduce((sum, prevYear) => {
        return sum + Math.abs(prevYear.capitalCall) + prevYear.distributionRecyclee;
      }, 0);
      
      const commitmentRestant = Math.max(0, data.souscription - capitalDejaAppele);

      // Pour la dette, pas de recyclage car c'est des coupons + remboursement
      if (data.investmentType === 'DEBT') {
        year.distributionRecyclee = 0;
      } else {
        // Recyclage uniquement quand capital call ET distribution la même année
        if (year.distribution > 0 && year.capitalCall < 0) {
          const capitalCallCetteAnnee = Math.abs(year.capitalCall);
          const recyclageNecessaire = Math.min(year.distribution, capitalCallCetteAnnee);
          year.distributionRecyclee = recyclageNecessaire;
        } else {
          year.distributionRecyclee = 0; // Pas de recyclage si pas de capital call
        }
      }

      // Cash décaissé = capital call + distribution recyclée (mais 0 si pas de capital call)
      // Les frais sont déjà déduits du montant investi au début
      year.montantRealDecaisse = year.capitalCall < 0 ? year.capitalCall + year.distributionRecyclee : 0;
      year.fluxNet = year.distribution - year.distributionRecyclee + year.capitalCall;

      const distributionNette = year.distribution - year.distributionRecyclee;
      if (distributionNette > 0) {
        let anneesRestantes: number;
        if (data.investmentType === 'SECONDARY') {
          // Pour le secondaire, valeur future calculée à T6
          anneesRestantes = Math.max(0, 6 - i);
        } else if (data.investmentType === 'DEBT') {
          // Pour la dette, valeur future calculée à T8 (fin des remboursements)
          anneesRestantes = Math.max(0, 8 - i);
        } else {
          // Pour LBO, VC et Growth Capital, valeur future calculée à T10
          anneesRestantes = 10 - i;
        }
        year.valeurFuture = distributionNette * Math.pow(1 + data.tauxReinvestissement, anneesRestantes);
      }

      totalCapitalCalled += Math.abs(year.capitalCall);
      totalActualCashOut += Math.abs(year.montantRealDecaisse);
      years.push(year);
    }

    // Calcul du TRI avec la vraie formule mathématique
    const calculateTRI = (fluxTresorerie: number[]): number => {
      // Méthode de Newton-Raphson pour résoudre VAN = 0
      let r = 0.1; // Estimation initiale de 10%
      const tolerance = 1e-6;
      const maxIterations = 100;
      
      for (let i = 0; i < maxIterations; i++) {
        let van = 0;
        let vanDerivee = 0;
        
        // Calcul de la VAN et de sa dérivée
        for (let t = 0; t < fluxTresorerie.length; t++) {
          const denominateur = Math.pow(1 + r, t);
          van += fluxTresorerie[t] / denominateur;
          if (t > 0) {
            vanDerivee -= (t * fluxTresorerie[t]) / Math.pow(1 + r, t + 1);
          }
        }
        
        // Si VAN est proche de 0, on a trouvé le TRI
        if (Math.abs(van) < tolerance) {
          return r;
        }
        
        // Mise à jour de r selon Newton-Raphson
        if (Math.abs(vanDerivee) > tolerance) {
          r = r - van / vanDerivee;
        }
      }
      
      return r; // Retourne la dernière estimation
    };

    // Préparer les flux de trésorerie (cash décaissé et valeurs futures)
    const fluxTresorerie = years.map(year => {
      // Utilise le cash décaissé (négatif) et les valeurs futures (positive)
      return year.montantRealDecaisse + year.valeurFuture;
    });
    
    // Calcul des résultats finaux - les frais sont déduits de la valeur finale
    const valeurFinaleAvantFrais = years.reduce((sum, year) => sum + year.valeurFuture, 0);
    const valeurFinaleReinvestie = valeurFinaleAvantFrais - fraisTotaux;
    const moic = valeurFinaleReinvestie / totalActualCashOut;
    const triAnnuel = calculateTRI(fluxTresorerie);

    setResults(years);
    setFinalResults({
      capitalTotalRealInvesti: totalCapitalCalled,
      capitalRealInvesti: totalActualCashOut,
      valeurFinaleReinvestie,
      moic,
      triAnnuel,
      fraisTotaux
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

  const handleInvestmentTypeChange = (type: 'BUYOUT' | 'VENTURE_CAPITAL' | 'SECONDARY' | 'GROWTH_CAPITAL' | 'DEBT') => {
    // Définir les MOIC par défaut selon le type d'investissement
    let defaultMoic = 2.5;
    let defaultRendement = 11;
    
    switch(type) {
      case 'VENTURE_CAPITAL':
        defaultMoic = 4;
        break;
      case 'GROWTH_CAPITAL':
        defaultMoic = 3.5;
        break;
      case 'SECONDARY':
        defaultMoic = 2.2;
        break;
      case 'BUYOUT':
        defaultMoic = 2.5;
        break;
      case 'DEBT':
        defaultRendement = 11;
        break;
      default:
        defaultMoic = 2.5;
    }
    
    setData(prev => ({
      ...prev,
      investmentType: type,
      moicCible: defaultMoic,
      rendementCible: defaultRendement
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
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="buyout"
                          name="investment-type"
                          value="BUYOUT"
                          checked={data.investmentType === 'BUYOUT'}
                          onChange={() => handleInvestmentTypeChange('BUYOUT')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="buyout" className="text-sm">Buyout</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="vc"
                          name="investment-type"
                          value="VENTURE_CAPITAL"
                          checked={data.investmentType === 'VENTURE_CAPITAL'}
                          onChange={() => handleInvestmentTypeChange('VENTURE_CAPITAL')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="vc" className="text-sm">Venture Capital</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="growth"
                          name="investment-type"
                          value="GROWTH_CAPITAL"
                          checked={data.investmentType === 'GROWTH_CAPITAL'}
                          onChange={() => handleInvestmentTypeChange('GROWTH_CAPITAL')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="growth" className="text-sm">Growth Capital</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="secondary"
                          name="investment-type"
                          value="SECONDARY"
                          checked={data.investmentType === 'SECONDARY'}
                          onChange={() => handleInvestmentTypeChange('SECONDARY')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="secondary" className="text-sm">Secondary</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="debt"
                          name="investment-type"
                          value="DEBT"
                          checked={data.investmentType === 'DEBT'}
                          onChange={() => handleInvestmentTypeChange('DEBT')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="debt" className="text-sm">Debt</Label>
                      </div>
                    </div>
                  </div>

                  {data.investmentType === 'DEBT' ? (
                    <div className="space-y-2">
                      <Label htmlFor="rendementCible">Rendement Cible (%)</Label>
                      <Input
                        id="rendementCible"
                        type="number"
                        step="0.1"
                        min="0"
                        value={data.rendementCible}
                        onChange={(e) => handleInputChange('rendementCible', Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Rendement annuel en % (ex: 11 pour 11% par an)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="moicCible">MOIC Cible</Label>
                      <Input
                        id="moicCible"
                        type="number"
                        step="0.1"
                        min="1"
                        value={data.moicCible}
                        onChange={(e) => handleInputChange('moicCible', Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Multiple sur le capital investi (ex: 2.5 = +150% de retour)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Résultats - Colonne de droite */}
            <div className="space-y-6 h-fit">
              {/* Résultats clés */}
              <div className="grid grid-cols-3 gap-4">
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
                    {Math.round(finalResults.capitalRealInvesti).toLocaleString('fr-FR')} €
                  </div>
                  <p className="text text-sm mt-1">Capital réel investi</p>
                </div>

                <div className="box relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Valeur totale de votre investissement à la fin de la période, incluant le réinvestissement des distributions nettes au taux de 15% annuel, après déduction des frais totaux.</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="big-number text-xl font-bold">
                    {Math.round(finalResults.valeurFinaleReinvestie).toLocaleString('fr-FR')} €
                  </div>
                  <p className="text text-sm mt-1">Valeur finale</p>
                </div>

                <div className="box relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Frais totaux de la plateforme sur 10 ans, déduits de la valeur finale. Comprend les frais d'entrée et les frais annuels de gestion.</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="big-number text-xl font-bold text-destructive">
                    -{Math.round(finalResults.fraisTotaux).toLocaleString('fr-FR')} €
                  </div>
                  <p className="text text-sm mt-1">Frais totaux</p>
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
                     {Math.round(finalResults.moic * 100) / 100}x
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
                    {Math.round(finalResults.triAnnuel * 100)}%
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
                           {year.capitalCall < 0 ? `${Math.round(year.capitalCall).toLocaleString('fr-FR')} €` : '-'}
                         </td>
                         <td className="text-right p-2 text-green-400">
                           {year.distribution > 0 ? `${Math.round(year.distribution).toLocaleString('fr-FR')} €` : '-'}
                         </td>
                         <td className="text-right p-2 text-blue-400 italic">
                           {year.distributionRecyclee > 0 ? `${Math.round(year.distributionRecyclee).toLocaleString('fr-FR')} €` : '-'}
                         </td>
                         <td className="text-right p-2 font-medium">
                           <span className={year.montantRealDecaisse > 0 ? 'text-green-400' : year.montantRealDecaisse < 0 ? 'text-red-400' : ''}>
                             {Math.round(year.montantRealDecaisse).toLocaleString('fr-FR')} €
                           </span>
                         </td>
                         <td className="text-right p-2 text-primary">
                           {year.valeurFuture > 0 ? `${Math.round(year.valeurFuture).toLocaleString('fr-FR')} €` : '-'}
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