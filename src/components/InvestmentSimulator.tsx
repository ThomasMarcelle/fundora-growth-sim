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
  profilInvestisseur: 'PERSONNE_PHYSIQUE' | 'PERSONNE_MORALE';
  reinvestirDistributions: boolean;
  typeReinvestissement: 'BUYOUT' | 'VENTURE_CAPITAL' | 'GROWTH_CAPITAL';
}

interface YearlyData {
  annee: number;
  capitalCall: number;
  distribution: number;
  coupon?: number; // Pour séparer les coupons dans la dette
  capitalRendu?: number; // Pour séparer le capital rendu dans la dette
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
    rendementCible: 11, // 11% pour la dette
    profilInvestisseur: 'PERSONNE_PHYSIQUE',
    reinvestirDistributions: false,
    typeReinvestissement: 'BUYOUT'
  });

  const [results, setResults] = useState<YearlyData[]>([]);
  const [finalResults, setFinalResults] = useState({
    capitalTotalRealInvesti: 0,
    capitalRealInvesti: 0,
    valeurFinaleReinvestie: 0,
    moic: 0,
    triAnnuel: 0,
    fraisTotaux: 0,
    impotsTotaux: 0,
    totalNetPercu: 0
  });

  const [resultsAvecReinvestissement, setResultsAvecReinvestissement] = useState({
    valeurFinale: 0,
    moic: 0,
    triAnnuel: 0,
    impotsTotaux: 0,
    totalNetPercu: 0
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
      anneeDebutDistribution = 5; // distributions commencent en année 5
      nombreAnneesDistribution = 6; // années 5-10
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
          // Capital call pour la dette : 3 ans d'investissement 35%-35%-30%
          if (i === 1) year.capitalCall = -montantNetInvesti * 0.35; // 35%
          else if (i === 2) year.capitalCall = -montantNetInvesti * 0.35; // 35%
          else if (i === 3) year.capitalCall = -montantNetInvesti * 0.30; // 30%
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
          // Capital call pour la dette : 3 ans d'investissement 35%-35%-30%
          if (i === 1) year.capitalCall = -montantNetInvesti * 0.35; // 35%
          else if (i === 2) year.capitalCall = -montantNetInvesti * 0.35; // 35%
          else if (i === 3) year.capitalCall = -montantNetInvesti * 0.30; // 30%
        } else { // BUYOUT
          if (i <= data.nombreAnnees) {
            year.capitalCall = -montantAppelAnnuel;
          }
        }
      }

      // Distributions selon la stratégie
      if (data.investmentType === 'DEBT') {
        // Logique spéciale pour la dette : coupons + remboursement du capital
        
        // Calculer le capital call cumulé jusqu'à cette année (incluse)
        const capitalCallCumule = years.slice(0, i).reduce((sum, prevYear) => 
          sum + Math.abs(prevYear.capitalCall), 0
        ) + Math.abs(year.capitalCall);
        
        // Calculer le capital rendu cumulé jusqu'à cette année (incluse) 
        const capitalRenduCumule = years.slice(0, i).reduce((sum, prevYear) => 
          sum + (prevYear.capitalRendu || 0), 0
        );
        
        // Remboursement du capital sur les années 4-7 (25% chaque année)
        let remboursementCapital = 0;
        if (i >= 4 && i <= 7) {
          remboursementCapital = totalActualCashOutEstimate * 0.25;
        }
        
        // Ajouter le remboursement de cette année au cumul pour le calcul des coupons
        const capitalRenduCumuleAvecCetteAnnee = capitalRenduCumule + remboursementCapital;
        
        // Coupons = rendement cible * (Capital call cumulé - Capital rendu cumulé)
        const capitalNetInvesti = Math.max(0, capitalCallCumule - capitalRenduCumuleAvecCetteAnnee);
        const couponAnnuel = capitalNetInvesti * (data.rendementCible / 100);
        
        // Stocker séparément les coupons et le capital rendu
        year.coupon = couponAnnuel;
        year.capitalRendu = remboursementCapital;
        year.distribution = couponAnnuel + remboursementCapital;
        
      } else if (data.investmentType === 'VENTURE_CAPITAL') {
        // VC : petite distribution en année 5, puis distributions croissantes années 6-10
        if (i === 5) {
          // Petite distribution en année 5 : 8% de la souscription initiale
          year.distribution = data.souscription * 0.08;
        } else if (i >= 6 && i <= 10) {
          // Reste distribué de manière croissante sur années 6-10
          const distribuionAnnee5 = data.souscription * 0.08;
          const resteADistribuer = valeurTotaleDistributions - distribuionAnnee5;
          const anneeDistribution = i - 6 + 1; // 1, 2, 3, 4, 5
          const totalAnneesDistrib = 5; // 5 années
          const facteurCroissance = (2 * anneeDistribution) / (totalAnneesDistrib + 1);
          year.distribution = (resteADistribuer / totalAnneesDistrib) * facteurCroissance;
        }
      } else if (data.investmentType === 'GROWTH_CAPITAL') {
        // Growth Capital : toute petite distribution en année 4, distribution en année 5, puis distributions croissantes années 6-10
        if (i === 4) {
          // Toute petite distribution en année 4 : 5% de la souscription initiale
          year.distribution = data.souscription * 0.05;
        } else if (i === 5) {
          // Distribution en année 5 : 15% de la souscription initiale
          year.distribution = data.souscription * 0.15;
        } else if (i >= 6 && i <= 10) {
          // Reste distribué de manière croissante sur années 6-10
          const distribuionAnnee4 = data.souscription * 0.05;
          const distribuionAnnee5 = data.souscription * 0.15;
          const resteADistribuer = valeurTotaleDistributions - distribuionAnnee4 - distribuionAnnee5;
          const anneeDistribution = i - 6 + 1; // 1, 2, 3, 4, 5
          const totalAnneesDistrib = 5; // 5 années
          const facteurCroissance = (2 * anneeDistribution) / (totalAnneesDistrib + 1);
          year.distribution = (resteADistribuer / totalAnneesDistrib) * facteurCroissance;
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
        // LBO : toute petite distribution en année 3, puis distributions à partir de l'année 4
        if (i === 3) {
          // Toute petite distribution en année 3 : 3% de la souscription initiale
          year.distribution = data.souscription * 0.03;
        } else if (i >= 4 && i <= 7) {
          // Rendre le montant net investi de manière croissante sur 4 années (4, 5, 6, 7)
          const distribuionAnnee3 = data.souscription * 0.03;
          const montantNetInvestiAjuste = montantNetInvesti - distribuionAnnee3;
          const anneeDistribution = i - 4 + 1; // 1, 2, 3, 4
          const facteurCroissance = (2 * anneeDistribution) / (4 + 1); // facteur croissant
          year.distribution = (montantNetInvestiAjuste / 4) * facteurCroissance;
        } else if (i >= 8 && i <= 10) {
          // Profit distribué de manière croissante en 3 années (8, 9, 10)
          const distribuionAnnee3 = data.souscription * 0.03;
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
          // Pour la dette, valeur future calculée à T7 (7 ans de durée de fonds)
          anneesRestantes = Math.max(0, 7 - i);
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

    // Calcul des impôts - flat tax 30% sur la plus-value uniquement pour personne physique
    let impotsTotaux = 0;
    let totalNetPercu = 0;
    
    if (data.profilInvestisseur === 'PERSONNE_PHYSIQUE') {
      const capital = totalActualCashOut;
      const totalDistributions = valeurFinaleReinvestie;
      const plusValue = Math.max(0, totalDistributions - capital);
      impotsTotaux = plusValue * 0.30;
      totalNetPercu = totalDistributions - impotsTotaux;
    } else {
      // Personne morale - IS non calculé
      totalNetPercu = valeurFinaleReinvestie;
    }

    setResults(years);
    setFinalResults({
      capitalTotalRealInvesti: totalCapitalCalled,
      capitalRealInvesti: totalActualCashOut,
      valeurFinaleReinvestie,
      moic,
      triAnnuel,
      fraisTotaux,
      impotsTotaux,
      totalNetPercu
    });

    // Calcul avec réinvestissement si activé
    if (data.reinvestirDistributions) {
      // Simuler le réinvestissement des distributions dans le type choisi
      let valeurTotaleAvecReinvest = 0;
      
      // TRI selon le type de réinvestissement
      const triReinvest = data.typeReinvestissement === 'VENTURE_CAPITAL' ? 0.15 : 
                          data.typeReinvestissement === 'GROWTH_CAPITAL' ? 0.133 : 0.096;
      
      // Calculer la valeur de chaque distribution réinvestie avec le TRI composé
      years.forEach(year => {
        const distributionNette = year.distribution - year.distributionRecyclee;
        if (distributionNette > 0) {
          // Nombre d'années jusqu'à la fin
          // Pour le secondaire dans les redistributions: 6 ans au lieu de 10
          const anneesRestantes = data.typeReinvestissement === 'BUYOUT' || data.typeReinvestissement === 'GROWTH_CAPITAL' 
            ? 6 - year.annee  // 6 ans pour secondaire (LBO et Growth)
            : 10 - year.annee; // 10 ans pour VC
          
          // Valeur future = Valeur initiale × (1 + TRI)^durée
          const valeurFuture = distributionNette * Math.pow(1 + triReinvest, Math.max(0, anneesRestantes));
          valeurTotaleAvecReinvest += valeurFuture;
        }
      });
      
      // Calcul impôts avec réinvestissement
      let impotsTotauxReinvest = 0;
      let totalNetPercuReinvest = 0;
      
      if (data.profilInvestisseur === 'PERSONNE_PHYSIQUE') {
        const plusValue = Math.max(0, valeurTotaleAvecReinvest - totalActualCashOut);
        impotsTotauxReinvest = plusValue * 0.30;
        totalNetPercuReinvest = valeurTotaleAvecReinvest - impotsTotauxReinvest;
      } else {
        totalNetPercuReinvest = valeurTotaleAvecReinvest;
      }
      
      const moicAvecReinvest = valeurTotaleAvecReinvest / totalActualCashOut;
      
      // TRI simplifié pour le réinvestissement
      const triAvecReinvest = Math.pow(moicAvecReinvest, 1/10) - 1;
      
      setResultsAvecReinvestissement({
        valeurFinale: valeurTotaleAvecReinvest,
        moic: moicAvecReinvest,
        triAnnuel: triAvecReinvest,
        impotsTotaux: impotsTotauxReinvest,
        totalNetPercu: totalNetPercuReinvest
      });
    }
  };

  useEffect(() => {
    calculateSimulation();
  }, [data]);

  const handleInputChange = (field: keyof SimulationData, value: number | string | boolean) => {
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

                  <div className="space-y-2 border-t pt-4">
                    <Label>Profil investisseur</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="personne-physique"
                          name="profil-investisseur"
                          value="PERSONNE_PHYSIQUE"
                          checked={data.profilInvestisseur === 'PERSONNE_PHYSIQUE'}
                          onChange={() => handleInputChange('profilInvestisseur', 'PERSONNE_PHYSIQUE')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="personne-physique" className="text-sm">Personne physique</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="personne-morale"
                          name="profil-investisseur"
                          value="PERSONNE_MORALE"
                          checked={data.profilInvestisseur === 'PERSONNE_MORALE'}
                          onChange={() => handleInputChange('profilInvestisseur', 'PERSONNE_MORALE')}
                          className="w-4 h-4 text-primary border-border focus:ring-primary"
                        />
                        <Label htmlFor="personne-morale" className="text-sm">Personne morale</Label>
                      </div>
                    </div>
                    {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' && (
                      <p className="text-xs text-muted-foreground">
                        Flat tax 30% appliquée sur la plus-value uniquement
                      </p>
                    )}
                    {data.profilInvestisseur === 'PERSONNE_MORALE' && (
                      <p className="text-xs text-amber-500">
                        IS non calculé pour le moment
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reinvestir">Réinvestir les distributions</Label>
                      <input
                        type="checkbox"
                        id="reinvestir"
                        checked={data.reinvestirDistributions}
                        onChange={(e) => handleInputChange('reinvestirDistributions', e.target.checked)}
                        className="w-4 h-4 text-primary border-border focus:ring-primary rounded"
                      />
                    </div>
                    {data.reinvestirDistributions && (
                      <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                        <Label className="text-sm">Type de réinvestissement</Label>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="reinvest-buyout"
                              name="type-reinvestissement"
                              value="BUYOUT"
                              checked={data.typeReinvestissement === 'BUYOUT'}
                              onChange={() => handleInputChange('typeReinvestissement', 'BUYOUT')}
                              className="w-4 h-4 text-primary border-border focus:ring-primary"
                            />
                            <Label htmlFor="reinvest-buyout" className="text-sm">LBO (2.5x)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="reinvest-vc"
                              name="type-reinvestissement"
                              value="VENTURE_CAPITAL"
                              checked={data.typeReinvestissement === 'VENTURE_CAPITAL'}
                              onChange={() => handleInputChange('typeReinvestissement', 'VENTURE_CAPITAL')}
                              className="w-4 h-4 text-primary border-border focus:ring-primary"
                            />
                            <Label htmlFor="reinvest-vc" className="text-sm">VC (4x)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="reinvest-growth"
                              name="type-reinvestissement"
                              value="GROWTH_CAPITAL"
                              checked={data.typeReinvestissement === 'GROWTH_CAPITAL'}
                              onChange={() => handleInputChange('typeReinvestissement', 'GROWTH_CAPITAL')}
                              className="w-4 h-4 text-primary border-border focus:ring-primary"
                            />
                            <Label htmlFor="reinvest-growth" className="text-sm">Growth (3.5x)</Label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Résultats - Colonne de droite */}
            <div className="space-y-6 h-fit">
              {/* Scénario sans réinvestissement */}
              <div className="box">
                <h3 className="text-lg font-semibold mb-4">
                  {data.reinvestirDistributions ? 'Sans réinvestissement' : 'Résultats'}
                </h3>
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
                       <p>Total Value to Paid-In capital : ratio entre la valeur finale et le capital réel investi. Correspond au MOIC cible de la stratégie choisie.</p>
                     </TooltipContent>
                   </Tooltip>
                   <div className="big-number text-xl font-bold">
                     {Math.round(data.moicCible * 100) / 100}x
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

                 <div className="box relative">
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                     </TooltipTrigger>
                     <TooltipContent className="max-w-xs">
                       <p>
                         {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' 
                           ? 'Impôts calculés avec flat tax 30% sur la plus-value uniquement' 
                           : 'IS non calculé pour le moment'}
                       </p>
                     </TooltipContent>
                   </Tooltip>
                   <div className="big-number text-xl font-bold text-amber-500">
                     {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' 
                       ? `-${Math.round(finalResults.impotsTotaux).toLocaleString('fr-FR')} €`
                       : 'N/A'}
                   </div>
                   <p className="text text-sm mt-1">Impôts</p>
                 </div>

                 <div className="box relative">
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                     </TooltipTrigger>
                     <TooltipContent className="max-w-xs">
                       <p>Total net perçu après impôts et frais</p>
                     </TooltipContent>
                   </Tooltip>
                   <div className="big-number text-xl font-bold text-green-500">
                     {Math.round(finalResults.totalNetPercu).toLocaleString('fr-FR')} €
                   </div>
                   <p className="text text-sm mt-1">Total net perçu</p>
                 </div>
               </div>
              </div>

              {/* Scénario avec réinvestissement */}
              {data.reinvestirDistributions && (
                <div className="box">
                  <h3 className="text-lg font-semibold mb-4">Avec réinvestissement ({
                    data.typeReinvestissement === 'VENTURE_CAPITAL' ? 'VC' :
                    data.typeReinvestissement === 'GROWTH_CAPITAL' ? 'Growth' : 'LBO'
                  })</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Valeur totale de votre investissement avec réinvestissement des distributions dans un fonds {
                            data.typeReinvestissement === 'VENTURE_CAPITAL' ? 'VC (TRI 15%)' :
                            data.typeReinvestissement === 'GROWTH_CAPITAL' ? 'Growth Capital (TRI 13,3%)' : 'LBO (TRI 9,6%)'
                          }.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(resultsAvecReinvestissement.valeurFinale).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Valeur finale</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Total Value to Paid-In capital avec réinvestissement : ratio entre la valeur finale totale (investissement initial + distributions réinvesties) et le capital réel investi.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(resultsAvecReinvestissement.moic * 100) / 100}x
                      </div>
                      <p className="text text-sm mt-1">TVPI</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Taux de Rendement Interne annualisé en réinvestissant les distributions dans un fonds {
                            data.typeReinvestissement === 'VENTURE_CAPITAL' ? 'VC' :
                            data.typeReinvestissement === 'GROWTH_CAPITAL' ? 'Growth Capital' : 'LBO'
                          }.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold">
                        {Math.round(resultsAvecReinvestissement.triAnnuel * 100)}%
                      </div>
                      <p className="text text-sm mt-1">TRI Annuel</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' 
                              ? 'Impôts totaux avec flat tax 30% appliquée sur les plus-values des distributions réinvesties' 
                              : 'IS non calculé pour le moment'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-amber-500">
                        {data.profilInvestisseur === 'PERSONNE_PHYSIQUE' 
                          ? `-${Math.round(resultsAvecReinvestissement.impotsTotaux).toLocaleString('fr-FR')} €`
                          : 'N/A'}
                      </div>
                      <p className="text text-sm mt-1">Impôts</p>
                    </div>

                    <div className="box relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Total net perçu après impôts et frais, en incluant les gains générés par le réinvestissement des distributions.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-green-500">
                        {Math.round(resultsAvecReinvestissement.totalNetPercu).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Total net perçu</p>
                    </div>

                    <div className="box relative bg-primary/10">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help absolute top-2 right-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Gain net supplémentaire généré par le réinvestissement des distributions par rapport au scénario sans réinvestissement.</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="big-number text-xl font-bold text-primary">
                        +{Math.round(resultsAvecReinvestissement.totalNetPercu - finalResults.totalNetPercu).toLocaleString('fr-FR')} €
                      </div>
                      <p className="text text-sm mt-1">Gain net</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tableau en bas */}
          <div className="mt-8">
            <div className="box">
              <h3 className="text-lg font-semibold mb-4">Détail par année</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                   <thead>
                     <tr className="border-b">
                       <th className="text-left p-2">Année</th>
                       <th className="text-right p-2">
                         <div className="flex items-center justify-end gap-1">
                           Capital Call
                           <Tooltip>
                             <TooltipTrigger>
                               <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Montant appelé par le fonds chaque année</p>
                             </TooltipContent>
                           </Tooltip>
                         </div>
                       </th>
                       {data.investmentType === 'DEBT' ? (
                         <>
                           <th className="text-right p-2">Coupon</th>
                           <th className="text-right p-2">Capital Rendu</th>
                         </>
                       ) : (
                         <th className="text-right p-2">Distribution</th>
                       )}
                       {data.investmentType !== 'DEBT' && (
                         <th className="text-right p-2">
                           <div className="flex items-center justify-end gap-1">
                             Distrib. Recyclée
                             <Tooltip>
                               <TooltipTrigger>
                                 <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                               </TooltipTrigger>
                               <TooltipContent className="max-w-xs">
                                 <p>Partie des distributions qui retourne automatiquement dans le fonds pour financer les futurs capital calls, réduisant votre cash réel à décaisser.</p>
                               </TooltipContent>
                             </Tooltip>
                           </div>
                         </th>
                       )}
                       <th className="text-right p-2">Cash Décaissé</th>
                       <th className="text-right p-2">
                         <div className="flex items-center justify-end gap-1">
                           Valeur Future
                           <Tooltip>
                             <TooltipTrigger>
                               <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                             </TooltipTrigger>
                             <TooltipContent className="max-w-xs">
                               <p>Valeur de la distribution nette réinvestie à 15% annuel jusqu'à l'année 10. Représente la croissance de votre cash libre grâce au réinvestissement.</p>
                             </TooltipContent>
                           </Tooltip>
                         </div>
                       </th>
                       {data.reinvestirDistributions && (
                         <>
                           <th className="text-right p-2 bg-primary/5">
                             <div className="flex items-center justify-end gap-1">
                               Distrib. à Réinvestir
                               <Tooltip>
                                 <TooltipTrigger>
                                   <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                                 </TooltipTrigger>
                                 <TooltipContent className="max-w-xs">
                                   <p>Montant des distributions disponibles pour réinvestissement dans {data.typeReinvestissement === 'VENTURE_CAPITAL' ? 'VC' : data.typeReinvestissement === 'GROWTH_CAPITAL' ? 'Growth Capital' : 'LBO'}</p>
                                 </TooltipContent>
                               </Tooltip>
                             </div>
                           </th>
                           <th className="text-right p-2 bg-primary/5">
                             <div className="flex items-center justify-end gap-1">
                               Valeur Réinvestie
                               <Tooltip>
                                 <TooltipTrigger>
                                   <Info className="w-3 h-3 text-muted-foreground hover:text-primary cursor-help" />
                                 </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>Valeur estimée de la distribution réinvestie avec un TRI de {data.typeReinvestissement === 'VENTURE_CAPITAL' ? '15%' : data.typeReinvestissement === 'GROWTH_CAPITAL' ? '13,3%' : '9,6%'} annuel jusqu'à l'année 10</p>
                                  </TooltipContent>
                               </Tooltip>
                             </div>
                           </th>
                         </>
                       )}
                     </tr>
                   </thead>
                   <tbody>
                      {results.map((year, index) => {
                        // Calculer les valeurs de réinvestissement pour chaque année avec TRI
                        const distributionNette = year.distribution - year.distributionRecyclee;
                        const triReinvest = data.typeReinvestissement === 'VENTURE_CAPITAL' ? 0.15 : 
                                            data.typeReinvestissement === 'GROWTH_CAPITAL' ? 0.133 : 0.096;
                        const anneesRestantes = 10 - year.annee;
                        const valeurReinvestie = distributionNette * Math.pow(1 + triReinvest, anneesRestantes);
                       
                       return (
                         <tr key={index} className="border-b border-border hover:bg-muted/50">
                           <td className="p-2 font-medium">{year.annee}</td>
                           <td className="text-right p-2 text-red-400">
                              {year.capitalCall < 0 ? `${Math.round(year.capitalCall).toLocaleString('fr-FR')} €` : '-'}
                            </td>
                            {data.investmentType === 'DEBT' ? (
                              <>
                                <td className="text-right p-2 text-green-400">
                                  {(year.coupon && year.coupon > 0) ? `${Math.round(year.coupon).toLocaleString('fr-FR')} €` : '-'}
                                </td>
                                <td className="text-right p-2 text-blue-400">
                                  {(year.capitalRendu && year.capitalRendu > 0) ? `${Math.round(year.capitalRendu).toLocaleString('fr-FR')} €` : '-'}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="text-right p-2 text-green-400">
                                  {year.distribution > 0 ? `${Math.round(year.distribution).toLocaleString('fr-FR')} €` : '-'}
                                </td>
                                <td className="text-right p-2 text-blue-400 italic">
                                  {year.distributionRecyclee > 0 ? `${Math.round(year.distributionRecyclee).toLocaleString('fr-FR')} €` : '-'}
                                </td>
                              </>
                            )}
                            <td className="text-right p-2 font-medium">
                              <span className={year.montantRealDecaisse > 0 ? 'text-green-400' : year.montantRealDecaisse < 0 ? 'text-red-400' : ''}>
                                {Math.round(year.montantRealDecaisse).toLocaleString('fr-FR')} €
                              </span>
                            </td>
                            <td className="text-right p-2 text-primary">
                              {year.valeurFuture > 0 ? `${Math.round(year.valeurFuture).toLocaleString('fr-FR')} €` : '-'}
                           </td>
                           {data.reinvestirDistributions && (
                             <>
                               <td className="text-right p-2 bg-primary/5 text-purple-400">
                                 {distributionNette > 0 ? `${Math.round(distributionNette).toLocaleString('fr-FR')} €` : '-'}
                               </td>
                               <td className="text-right p-2 bg-primary/5 text-primary font-medium">
                                 {valeurReinvestie > 0 ? `${Math.round(valeurReinvestie).toLocaleString('fr-FR')} €` : '-'}
                               </td>
                             </>
                           )}
                         </tr>
                       );
                     })}
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