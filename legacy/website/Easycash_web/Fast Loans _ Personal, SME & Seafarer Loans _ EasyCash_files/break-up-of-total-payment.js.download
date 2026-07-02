Chart.register(ChartDataLabels);
function break_up_of_total_payment_chart(brkData){ 
    var tInterest = parseFloat((brkData.total_interest).replace(/,/g, ''));
    var total_principal = parseFloat((brkData.total_principal).replace(/,/g, ''));
    var downPayment = 0;
    var tprepayment = 0;
    var ballon_amount = 0;

    if (typeof brkData.down_payment !== 'undefined'){

        downPayment = parseFloat((brkData.down_payment).replace(/,/g, ''));

    }

    if (typeof brkData.total_extra_payment !== 'undefined'){

        tprepayment = parseFloat((brkData.total_extra_payment).replace(/,/g, ''));

    }


    if (typeof brkData.ballon_amount !== 'undefined'){

        ballon_amount = parseFloat((brkData.ballon_amount).replace(/,/g, ''));

    }

    var totalPayment = tInterest + total_principal;

    var breakup_chartCanvas = document.getElementById("break-up-total-payment-chart");
   
    if(downPayment>0){        
        totalPayment = totalPayment + downPayment;
    }

    if(tprepayment>0){            
        totalPayment = totalPayment + tprepayment;
    }

    if(ballon_amount>0){            
        totalPayment = totalPayment + ballon_amount;
    }  
    
    var total_interest_percentage = ((tInterest / totalPayment) * 100);
    var total_principal_percentage =  ((total_principal / totalPayment) * 100);
    var down_payment_percentage = ((downPayment / totalPayment) * 100);    
    var prepayment_percentage = ((tprepayment / totalPayment) * 100);   
    var ballon_amount_percentage = ((ballon_amount / totalPayment) * 100);     

    var labels = [setting_data.principal_label, setting_data.total_interest_label];

    var data = [total_principal_percentage, total_interest_percentage.toFixed(2)];

    var backgroundColor = [setting_data.summary_chart_principal_fill_color,setting_data.summary_chart_interest_fill_color];

    var borderColor = [setting_data.summary_chart_principal_fill_color, setting_data.summary_chart_interest_fill_color];    

    if(downPayment>0){

        labels.push(setting_data.down_payment_label_str);
        data.push(down_payment_percentage);
        backgroundColor.push(setting_data.summary_chart_down_payment_fill_color);
        borderColor.push(setting_data.summary_chart_down_payment_fill_color);

    }

    if(tprepayment>0){

        labels.push(setting_data.extra_payment_label);
        data.push(prepayment_percentage);
        backgroundColor.push(setting_data.summary_chart_extra_payment_fill_color);
        borderColor.push(setting_data.summary_chart_extra_payment_fill_color);
    }


    if(ballon_amount>0){

        labels.push(setting_data.ballon_amount_label);
        data.push(ballon_amount_percentage);
        backgroundColor.push(setting_data.summary_chart_ballon_payment_fill_color);
        borderColor.push(setting_data.summary_chart_ballon_payment_fill_color);
    }    

    if (Chart.getChart('break-up-total-payment-chart')) { 
        Chart.getChart('break-up-total-payment-chart').destroy();
    }
    var breakupData = {
        labels: labels,
        datasets: [
        {
            data: data,
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            borderWidth: 2, 
            offset: [0, 15] 
        }]
    };
   
    var pieChart = new Chart(breakup_chartCanvas, {
          type: 'pie',
          data: breakupData,
          options: {
            plugins: {
              legend: {
                    position: 'bottom',
                    labels: {
                      usePointStyle: true,
                  },
              },
                datalabels: {
                    color: '#fff',
                     font: {
                      weight: 'bold',
                      size: 15,
                    },
                    formatter: (value) => {
                        var v = parseFloat(value);
                      return v.toFixed(2) + '%';
                  },
                  display:false,
              },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            var value = parseFloat(context.formattedValue);
                            value = value.toFixed(2);
                            return context.label + ': ' + value + '%';
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    borderColor: '#ffffff',
                    borderWidth: 2, 
                    displayColors: false 
                }
            },
            elements: {
                arc: {
                    borderWidth: 0
                }
            }
        },
    });
}