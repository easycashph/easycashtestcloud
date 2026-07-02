jQuery(document).ready(function ($) {
  "use strict";
  
  jQuery(".contact-book-btn").click(function () {
    jQuery(".contact-us-popup").show();
    jQuery("body").addClass("body-overflow-hidden");
  });
  
  /*****************************************************************************************/
  /** Attention!!! This JS for Default theme and New theme (In If elase condition)||********/
  /*****************************************************************************************/
  
  const element = document.getElementById("main-sec");
  
  /*****************************************************************************************/
  /******************** START : Condition For New theme ************************************/
  /*****************************************************************************************/
  
 if (element != null && element.classList.contains("new-theme-template-section")) {
    //Condition For New theme
    function loan_calculation_process() {
      var currency_symbol = setting_data.currency_symbols; 

      var default_nop_value = jQuery("input[name='loan_terms']").val();
      /* visible note below chart */
      if(default_nop_value > 120){
        jQuery('body').find('.chart-note').show();
      }else{
        jQuery('body').find('.chart-note').hide();
      }

     var loan_amount = jQuery("#loan_amount").val();     

     var monthly_payment = 0;
     var repayment_frequency_val = jQuery("#repayment_freq").val();  

    jQuery("input[name='current_repayment_freq']").val(repayment_frequency_val);

    var ballon_amounts_per_sign = jQuery("#ballon_amounts_per").val();
    if (!ballon_amounts_per_sign.endsWith("%")) {
      jQuery("#ballon_amounts_per").val(ballon_amounts_per_sign + "%");
    }

    var interest_rates_sign = jQuery("#interest_rates").val();
    if (!interest_rates_sign.endsWith("%")) {
      jQuery("#interest_rates").val(interest_rates_sign + "%");
    }

    var loan_amount = jQuery("#loan_amount")
    .val()
    .replaceAll(currency_symbol, "");

    if (setting_data.remove_decimal_point == 1) {
      loan_amount = parseInt(loan_amount.replaceAll(",", ""));
    } else {
      loan_amount = parseFloat(loan_amount.replaceAll(",", ""));
    }


      /* down payment code start */

    if (setting_data.down_payment_option == '1') {  

      if (setting_data.down_payment_mode == 'percentage') {

        document.getElementById("down_payment_range").max = setting_data.down_payment_max_per; 

        var down_payment_range = document.getElementById("down_payment_range");

        if (setting_data.remove_decimal_point == 1) {
          var value = parseInt(
            ((down_payment_range.value - down_payment_range.min) /
              (down_payment_range.max - down_payment_range.min)) *
            100
            );
          down_payment_range.style.background =
          "linear-gradient(to right, #555555 0%, #555555 " +
          value +
          "%, #fff " +
          value +
          "%, " +
          setting_data.back_ground_color +
          " 100%)";    
        } else {
          var value =
          ((down_payment_range.value - down_payment_range.min) /
            (down_payment_range.max - down_payment_range.min)) *
          100;
          down_payment_range.style.background =
          "linear-gradient(to right, #555555 0%, #555555 " +
          value +
          "%, #fff " +
          value +
          "%, " +
          setting_data.back_ground_color +
          " 100%)";    
        }


        var down_payment_per = jQuery("#down_payment_per").val();

        if (setting_data.remove_decimal_point == 1) {
          down_payment_per = parseInt(down_payment_per);
          jQuery("#down_payment_per_dis").html(down_payment_per + "%");    
        } else {
          down_payment_per = parseFloat(down_payment_per);
          jQuery("#down_payment_per_dis").html(
            down_payment_per.toFixed(2) + "%"
            );      
        }



        var down_payment =
        parseInt(
          (parseInt(loan_amount) *
            parseInt(down_payment_per)
            )) / 100;

        loan_amount = loan_amount - parseInt(down_payment);

        jQuery("#bottom_down_payment_per").html(parseInt(down_payment_per));
        jQuery("#bottom_down_payment").html(addCommas(parseInt(down_payment)));   
        jQuery("#down_payment").val(addCommas(parseInt(down_payment))); 
        var down_payment_per_sign = jQuery("#down_payment_per").val();
        if (!down_payment_per_sign.endsWith("%")) {
          jQuery("#down_payment_per").val(down_payment_per_sign + "%");
        }



      }
      else{

        var down_payment = parseInt(jQuery("#down_payment").val());     

        if(isNaN(down_payment)){

          jQuery("#down_payment").val('');
        }
        else if(down_payment >= loan_amount){
          jQuery("#down_payment").val('');
        } 
        else if (down_payment >  0 && down_payment < loan_amount) { 

          loan_amount = loan_amount - parseInt(down_payment);

        }

      }         



      if (down_payment == "") {
        down_payment = 0;
      }
      if (down_payment > 0) {
        jQuery("#down_payment_section").show();
      } else {
        jQuery("#down_payment_section").hide();
      }

    }   


      /* down payment code end */

      /* extra payment code start */

    if (setting_data.extra_payment_option == '1') {       

      var extra_payment = parseInt(jQuery("#extra_payment").val().replaceAll(",", ""));     

      if(isNaN(extra_payment)){
        jQuery("#extra_payment").val(0);
        extra_payment = 0;
        document.getElementById("extra_payment_range").value = 0; 
      }
      else if(extra_payment > loan_amount){
        jQuery("#extra_payment").val(0);
        extra_payment = 0;
        document.getElementById("extra_payment_range").value = 0; 
      } 


      if (extra_payment == "") {
        extra_payment = 0;
      }

      var extra_payment_max_per = parseInt(setting_data.extra_payment_max_per);

      var extra_payment_max_val =  parseInt((loan_amount * extra_payment_max_per) / 100);

      document.getElementById("extra_payment_range").max = extra_payment_max_val; 

      var extra_payment_range = document.getElementById("extra_payment_range");

      var value = parseInt(
        ((extra_payment_range.value - extra_payment_range.min) /
          (extra_payment_range.max - extra_payment_range.min)) *
        100
        );
      extra_payment_range.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)"; 

      if (extra_payment > 0) {
        jQuery("#extra_payment_section").show();
        jQuery("#bottom_extra_payment").html(addCommas(parseInt(extra_payment)));
        jQuery("#extra_payment_saved_time_section").show();
        jQuery("#extra_payment_total_section").show();
        jQuery("#extra_payment_saved_interest_section").show();

      } else {
        jQuery("#extra_payment_section").hide();
        jQuery("#extra_payment_saved_time_section").hide();
        jQuery("#extra_payment_total_section").hide();
        jQuery("#extra_payment_saved_interest_section").hide();
        jQuery("#bottom_total_extra_payment").text('');
      }

    }   


      /* extra payment code end */


    if (setting_data.remove_decimal_point == 1) {
      var interest_rates = parseInt(jQuery("#interest_rates").val());
    } else {
      var interest_rates = parseFloat(
        jQuery("#interest_rates").val().replaceAll("%", "")
        );
    }

    var ballon_amounts_per = jQuery("#ballon_amounts_per")
    .val()
    .replaceAll("%", "");
    var loan_terms_month = 0;
    var total_months_terms = 0;

    var loan_terms = jQuery("#loan_terms").val();

    if (loan_terms > 0) {
      total_months_terms = cal_loan_terms_by_frequency_payment_option(
        repayment_frequency_val,
        loan_terms
        );
      loan_terms_month = loan_terms;
    }



      /* display loan terms as year and months start */

    if (loan_terms > 0) {     

      convert_total_terms_to_year_month(loan_terms,repayment_frequency_val);
      convert_total_terms_to_year_month_for_loan_term_frequency_label(loan_terms,repayment_frequency_val);

    }


      /* display loan terms as year and months end */



    document.getElementById("ballon_amount_range").max = 80;

    var payment_type = jQuery("#payment_type").val();

    var loan_advance_interest = 0;
    var adloan_amount = 0;
    if (payment_type == "In Advance") {
      if (setting_data.remove_decimal_point == 1) {
        adloan_amount = cal_advance_loan_amount_by_frequency_val(
          repayment_frequency_val,
          loan_amount,
          interest_rates
          );
        var advance_cal = loan_advance_interest_cal(
          repayment_frequency_val,
          adloan_amount,
          interest_rates
          );
        loan_advance_interest = parseInt(advance_cal.loan_advance_interest);
        loan_amount = adloan_amount;
      } else {
        adloan_amount = cal_advance_loan_amount_by_frequency_val(
          repayment_frequency_val,
          loan_amount,
          interest_rates
          );
        var advance_cal = loan_advance_interest_cal(
          repayment_frequency_val,
          loan_amount,
          interest_rates
          );
        loan_advance_interest = advance_cal.loan_advance_interest;
        loan_amount = adloan_amount;
      }
    }
    if (setting_data.remove_decimal_point == 1) {
      var ballon_amounts =
      parseInt(
        (parseInt(loan_amount) + parseInt(loan_advance_interest)) *
        parseInt(ballon_amounts_per)
        ) / 100;
      jQuery("#bill_ballon_per").html(parseInt(ballon_amounts_per));
      jQuery("#bill_ballon_amt").html(addCommas(parseInt(ballon_amounts)));
    } else {
      var ballon_amounts =
      parseFloat(
        (parseFloat(loan_amount) + parseFloat(loan_advance_interest)) *
        parseFloat(ballon_amounts_per)
        ) / 100;
      jQuery("#bill_ballon_per").html(
        parseFloat(ballon_amounts_per).toFixed(2)
        );
      jQuery("#bill_ballon_amt").html(addCommas(ballon_amounts.toFixed()));
    }
    if (setting_data.remove_decimal_point == 1) {
      jQuery("#ballon_amounts").val(addCommas(parseInt(ballon_amounts)));
    } else {
      jQuery("#ballon_amounts").val(
        addCommas(parseFloat(ballon_amounts).toFixed(2))
        );
    }

    if (parseFloat(ballon_amounts) > parseFloat(loan_amount)) {
      if (setting_data.remove_decimal_point == 1) {
        var new_ballon_amt =
        parseInt(
          (parseInt(loan_amount) + parseInt(loan_advance_interest)) *
          parseInt(ballon_amounts_per)
          ) / 100;
        jQuery("#ballon_amounts").val(addCommas(parseInt(new_ballon_amt)));
        jQuery("#bill_ballon_amt").html(addCommas(parseInt(ballon_amounts)));
      } else {
        var new_ballon_amt =
        parseFloat(
          (parseFloat(loan_amount) + parseFloat(loan_advance_interest)) *
          parseFloat(ballon_amounts_per)
          ) / 100;
        jQuery("#ballon_amounts").val(addCommas(new_ballon_amt.toFixed(2)));
        jQuery("#bill_ballon_amt").html(addCommas(ballon_amounts.toFixed(2)));
      }
    }

    var ballon_amounts = jQuery("#ballon_amounts").val();
    ballon_amounts = ballon_amounts.replaceAll(",", "");
    if (ballon_amounts == "") {
      ballon_amounts = 0;
    }
    if (ballon_amounts > 0) {
      jQuery("#ballon_amt_section").show();
    } else {
      jQuery("#ballon_amt_section").hide();
    }
    if (setting_data.remove_decimal_point == 1) {
      ballon_amounts_per = parseInt(ballon_amounts_per);
      jQuery("#interest_rate_range_dis").html(
        jQuery("#interest_rates").val() + "%"
        );
      jQuery("#ballon_amounts_per_dis").html(ballon_amounts_per + "%");
    } else {
      ballon_amounts_per = parseFloat(ballon_amounts_per);
      jQuery("#interest_rate_range_dis").html(
        jQuery("#interest_rates").val() + "%"
        );
      jQuery("#ballon_amounts_per_dis").html(
        ballon_amounts_per.toFixed(2) + "%"
        );
    }

    var loan_amount_range = document.getElementById("loan_amount_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((loan_amount_range.value - loan_amount_range.min) /
          (loan_amount_range.max - loan_amount_range.min)) *
        100
        );
    } else {
      var value =
      ((loan_amount_range.value - loan_amount_range.min) /
        (loan_amount_range.max - loan_amount_range.min)) *
      100;
    }
    loan_amount_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";

    var interest_rate_range = document.getElementById("interest_rate_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((interest_rate_range.value - interest_rate_range.min) /
          (interest_rate_range.max - interest_rate_range.min)) *
        100
        );
    } else {
      var value =
      ((interest_rate_range.value - interest_rate_range.min) /
        (interest_rate_range.max - interest_rate_range.min)) *
      100;
    }
    interest_rate_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";

    var loan_terms_range = document.getElementById("loan_terms_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((loan_terms_range.value - loan_terms_range.min) /
          (loan_terms_range.max - loan_terms_range.min)) *
        100
        );
    } else {
      var value =
      ((loan_terms_range.value - loan_terms_range.min) /
        (loan_terms_range.max - loan_terms_range.min)) *
      100;
    }
    loan_terms_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";

    var ballon_amount_range = document.getElementById("ballon_amount_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((ballon_amount_range.value - ballon_amount_range.min) /
          (ballon_amount_range.max - ballon_amount_range.min)) *
        100
        );
      ballon_amount_range.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)";
      loan_terms = parseInt(loan_terms / 12);
      loan_terms = parseInt(loan_terms);
    } else {
      var value =
      ((ballon_amount_range.value - ballon_amount_range.min) /
        (ballon_amount_range.max - ballon_amount_range.min)) *
      100;
      ballon_amount_range.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)";
      loan_terms = parseFloat(loan_terms / 12).toFixed(2);
      loan_terms = parseFloat(loan_terms);
    }

    if (setting_data.remove_decimal_point == 1) {
      var emi_cal = cal_emi_amount_frequency_payment_options(
        repayment_frequency_val,
        loan_amount,
        interest_rates,
        loan_terms_month,
        ballon_amounts
        );

      monthly_payment = parseInt(emi_cal.emi_amount);

      var total_interests = (monthly_payment * loan_terms_month) - loan_amount;


      var per_month_ballon_amt = 0;
      var ballon_amt_interest = 0;
      if (ballon_amounts > 0) {

        ballon_amt_interest = cal_total_interest_on_balloon_amount(repayment_frequency_val,ballon_amounts,interest_rates,loan_terms_month);
        per_month_ballon_amt = ballon_amt_interest / loan_terms_month;
      }
    } else {
      var emi_cal = cal_emi_amount_frequency_payment_options(
        repayment_frequency_val,
        loan_amount,
        interest_rates,
        loan_terms_month,
        ballon_amounts
        );
      monthly_payment = emi_cal.emi_amount;

      var total_interests = (monthly_payment * loan_terms_month) - loan_amount;

      var per_month_ballon_amt = 0;
      var ballon_amt_interest = 0;
      if (ballon_amounts > 0) {

        ballon_amt_interest = cal_total_interest_on_balloon_amount(repayment_frequency_val,ballon_amounts,interest_rates,loan_terms_month);     
          per_month_ballon_amt = ballon_amt_interest / loan_terms_month;
      }
    }

    var loan_terms = jQuery("#loan_terms").val();

    if (setting_data.remove_decimal_point == 1) {  

      if(repayment_frequency_val=='Fortnight'){

        loan_terms = parseInt(loan_terms / 26);

      }
      else if(repayment_frequency_val=='Weekly'){


        loan_terms = parseInt(loan_terms / 52);

      }
      else{

       loan_terms = parseInt(loan_terms / 12);

     }




     total_interests =
     parseInt(total_interests) +
     parseInt(ballon_amounts) +
     parseInt(ballon_amt_interest);
     monthly_payment =
     parseInt(monthly_payment) + parseInt(per_month_ballon_amt);


   } else {

    if(repayment_frequency_val=='Fortnight'){


      loan_terms = parseFloat(loan_terms / 26).toFixed(2);

    }
    else if(repayment_frequency_val=='Weekly'){


      loan_terms = parseFloat(loan_terms / 52).toFixed(2);          

    }
    else{

      loan_terms = parseFloat(loan_terms / 12).toFixed(2);             

    }


    loan_terms = parseFloat(loan_terms);
    total_interests =
    parseFloat(total_interests) +
    parseFloat(ballon_amounts) +
    parseFloat(ballon_amt_interest);
    monthly_payment =
    parseFloat(monthly_payment) + parseFloat(per_month_ballon_amt);
  }

    /* START: Total Fee Calculation */
  jQuery("#loan_terms_range").val();
  var monthly_fee = setting_data.monthly_rate;
  var application_fee = setting_data.application_fee;
  if (setting_data.calculation_fee_setting_enable == 1) {

    if (setting_data.remove_decimal_point == 1) {

      var loan_terms_for_fee = 0 ;


      if(repayment_frequency_val=='Fortnight'){


        loan_terms_for_fee = parseInt(loan_terms * 26 / 12);

      }
      else if(repayment_frequency_val=='Weekly'){


       loan_terms_for_fee = parseInt(loan_terms * 52 / 26);

     }
     else{


      loan_terms_for_fee = parseInt(loan_terms)

    }


    var total_regular_fee_amt = parseInt(loan_terms_for_fee) * 120;
    total_regular_fee_amt = parseInt(total_regular_fee_amt).toFixed(2);
    jQuery("#total_regular_fee_amt").html(total_regular_fee_amt);

    var total_fee =
    parseInt(application_fee) + parseInt(total_regular_fee_amt);
    jQuery("#total_fee_amt").html(total_fee);


  } else {


    var loan_terms_for_fee = 0 ;


    if(repayment_frequency_val=='Fortnight'){


      loan_terms_for_fee = parseFloat(loan_terms * 26 / 12).toFixed(2);

    }
    else if(repayment_frequency_val=='Weekly'){


      loan_terms_for_fee = parseFloat(loan_terms * 52 / 12).toFixed(2);         

    }
    else{

      loan_terms_for_fee = parseFloat(loan_terms).toFixed(2);;


    }

    var total_regular_fee_amt = parseFloat(loan_terms_for_fee) * 120;
    total_regular_fee_amt = parseFloat(total_regular_fee_amt).toFixed(2);
    jQuery("#total_regular_fee_amt").html(total_regular_fee_amt);

    var total_fee =
    parseFloat(application_fee) + parseFloat(total_regular_fee_amt);
    jQuery("#total_fee_amt").html(total_fee);
  }
}
  /* END : Total Fee Calculation*/

  /* check for the inifinity and NAN value */

if(monthly_payment==Infinity || monthly_payment == 'NaN' || Number.isNaN(monthly_payment) == Number.isNaN(NaN)){

  monthly_payment = 0;
}


if (setting_data.remove_decimal_point == 1) {

  if (setting_data.calculation_fee_setting_enable == 1) {     

    jQuery("#per_month_amount").html(
      addCommas(
        Math.round(parseInt(monthly_payment))
        )
      );


  } else {
    jQuery("#per_month_amount").html(
      addCommas(Math.round(parseInt(monthly_payment)))
      );
  }
} else {

  if (setting_data.calculation_fee_setting_enable == 1) {

    jQuery("#per_month_amount").html(
      addCommas(
        parseFloat(monthly_payment).toFixed(2)
        )
      );


  } else {
    jQuery("#per_month_amount").html(
      addCommas(parseFloat(monthly_payment).toFixed(2))
      );
  }
}

  /* STRAT : Interests Field Fill*/


convert_total_terms_to_year_month(loan_terms_month,repayment_frequency_val);
convert_total_terms_to_year_month_for_loan_term_frequency_label(loan_terms_month,repayment_frequency_val);


    //var loan_amount_term_label = 'per ' + repayment_frequency_val.slice(0, -2) + ' for ';
var loan_amount_term_label = "";
if (repayment_frequency_val == "Yearly") {
  loan_amount_term_label = setting_data.repay_freq_per_year_label;
} else if (repayment_frequency_val == "Quarterly") {
  loan_amount_term_label = setting_data.repay_freq_per_quarter_label;
} else if (repayment_frequency_val == "Weekly") {
  loan_amount_term_label = setting_data.repay_freq_per_week_label;
} else if (repayment_frequency_val == "Fortnight") {
  loan_amount_term_label = setting_data.repay_freq_per_fortnight_label;
} else {
  loan_amount_term_label = setting_data.repay_freq_per_month_label;
}

jQuery("#loan_amount_term_label").html(loan_amount_term_label);

if (setting_data.extra_payment_option == '1') {

  jQuery("#extra_payment_loan_amount_term_label").html(loan_amount_term_label.replaceAll('for',''));

}

if (setting_data.remove_decimal_point == 1) {
  jQuery("#loan_amount_rate").html(interest_rates);

  var total_int_amt = addCommas(
    Math.round(
      parseInt(total_interests) - parseInt(loan_advance_interest)
      )
    )

        /* check for NAN value */

  if(total_int_amt=='NaN'){
    total_int_amt = 0;
  }


  jQuery("#total_interests_amt").html(addCommas(total_int_amt));
  jQuery("#total_interests_amt_hidden").html(addCommas(total_int_amt));



} else {
  jQuery("#loan_amount_rate").html(interest_rates.toFixed(2));
  if (interest_rates === 0) {
    jQuery("#total_interests_amt").html(
      addCommas(Math.round(parseFloat(0) - parseFloat(0)))
      );

    jQuery("#total_interests_amt_hidden").html(
      addCommas(Math.round(parseFloat(0) - parseFloat(0)))
      );


  } else {

    var total_sum_interests =
    total_interests < loan_advance_interest ? parseFloat(total_interests).toFixed(2):parseFloat(total_interests).toFixed(2);


       /* check for NAN value */  
    if(total_sum_interests=='NaN'){
      total_sum_interests = '0.00';
    }

    jQuery("#total_interests_amt").html(total_sum_interests);
    jQuery("#total_interests_amt_hidden").html(total_sum_interests);


  }
}

    //jQuery("#total_interests_years").html(display_year_str);

var currency_symbols = setting_data.currency_symbols;

var balance = loan_amount;
var table_data = "";
var rmv_decimal = 0;
var is_advanced = "";
var count = loan_terms_month;


  /* down payment entry in table start */

if (setting_data.down_payment_option == '1') {

  if(parseInt(down_payment) > 0 ){  

    if (setting_data.remove_decimal_point == 1) {

      var table_down_payment = currency_symbols+parseInt(down_payment);
      if(loan_advance_interest > 0){
        var table_loan_amout = parseInt(loan_amount) + parseInt(loan_advance_interest);
      }else{
        var table_loan_amout = parseInt(loan_amount);
      }
      var table_int_rate = currency_symbols+'0';

    }
    else{

      var table_down_payment = currency_symbols+parseFloat(down_payment).toFixed(2);
      if(loan_advance_interest > 0){
        var table_loan_amout = (parseFloat(loan_amount) + parseFloat(loan_advance_interest)).toFixed(2);
      }else{
        var table_loan_amout = parseFloat(loan_amount).toFixed(2);
      }
      var table_int_rate = currency_symbols+'0';

    }


    table_data += '<tr>';
    table_data += '<td>*</td>';
    table_data += '<td>-' +table_down_payment+ '<br/><span style="font-weight: bold;font-size:12px;">('+setting_data.down_payment_label_str+')</span></td>';
    if(setting_data.extra_payment_option == '1'){
      table_data += '<td class="extra-payment-column">'+currency_symbols+'0.00'+'</td>';
    }
    table_data += '<td>'+table_int_rate+'</td>';
    table_data += '<td>'+currency_symbols+''+table_loan_amout + '</td>';
    table_data += '</tr>';

  }

}

  /* down payment entry in table end  */

if (setting_data.extra_payment_option == '1') { 
  var old_balance_for_extra_pay = 0; 
  var total_interest_for_extra_pay = 0;
  var total_extra_payment = 0;     
} 


if (payment_type == "In Advance") {

     table_data += '<tr>';
        table_data += '<td>*</td>';
        table_data += '<td>'+currency_symbols+'0.00'+'</td>';
        if(setting_data.extra_payment_option == '1'){
          table_data += '<td class="extra-payment-column">'+currency_symbols+'0.00'+'</td>';
        }
        table_data += '<td>'+currency_symbols+''+(setting_data.remove_decimal_point == 1 ? parseInt(loan_advance_interest): parseFloat(loan_advance_interest).toFixed(2))+'<span style="font-weight: bold;font-size:12px;"> (Advanced)</span></td>';
        table_data += '<td>'+currency_symbols+ '' +(setting_data.remove_decimal_point == 1 ? parseInt(loan_amount) : parseFloat(loan_amount) )+ '</td>';
        table_data += '</tr>';
}


for (var i = 1; i <= loan_terms_month; i++) {
  if (setting_data.remove_decimal_point == 1) {
    rmv_decimal = 1;
  } else {
    rmv_decimal = 0;
  }



  count = loan_terms_month - i;

  var interest = cal_interest_amount_by_fre_payment_option(
    repayment_frequency_val,
    count,
    balance,
    interest_rates,
    rmv_decimal
    );

  if (setting_data.remove_decimal_point == 1) {
    var principal = parseInt(monthly_payment) - parseInt(interest);
  } else {
    var principal =
    parseFloat(monthly_payment) - parseFloat(interest).toFixed(2);
  }


  if (setting_data.extra_payment_option == '1') { 
   old_balance_for_extra_pay = balance; 
 } 

 balance = balance - principal;


       /* deduct extra payment from  balance in table entry */

 if (setting_data.extra_payment_option == '1') {        

  balance = balance - extra_payment; 
}  

      /* deduct extra payment from  balance in table entry */



table_data += "<tr class='emi-row'>";
table_data += "<td>" + i + "</td>";
if (setting_data.remove_decimal_point == 1) {
  var display_monthly_payment = Math.ceil(monthly_payment);
} else {
  var display_monthly_payment = monthly_payment;
}
if (i == loan_terms_month) {
  if (setting_data.remove_decimal_point == 1) {
    display_monthly_payment =
    parseInt(display_monthly_payment) + parseInt(ballon_amounts);
  } else {
    display_monthly_payment =
    parseFloat(display_monthly_payment) + parseFloat(ballon_amounts);
  }
}

if (interest < 0) {
  interest = 0;
}


       /* EMI column of table code */

if(setting_data.extra_payment_option == '1' && extra_payment > 0 && parseInt(balance)<0){

  var Updated_EMI;


  if(old_balance_for_extra_pay < display_monthly_payment){              

    if(ballon_amounts > 0){

      if(ballon_amounts > old_balance_for_extra_pay){

        Updated_EMI = Number(old_balance_for_extra_pay)+Number(interest);

      }
      else{

        Updated_EMI = Number(old_balance_for_extra_pay)+Number(interest)+parseFloat(ballon_amounts);

        if(Updated_EMI > old_balance_for_extra_pay){
          Updated_EMI = Number(old_balance_for_extra_pay)+Number(interest);
        }


      }


    }
    else{
      Updated_EMI = Number(old_balance_for_extra_pay)+Number(interest);
    }

    if (setting_data.remove_decimal_point == 1) {
      table_data +=
      "<td>-" +
      currency_symbols +
      parseInt(Updated_EMI) +
      "</td>";
    } else {
      table_data +=
      "<td>-" +
      currency_symbols +
      parseFloat(Updated_EMI).toFixed(2) +
      "</td>";
    }

  }
  else{

    if(ballon_amounts > 0){

      if(ballon_amounts > old_balance_for_extra_pay){

        Updated_EMI  = parseFloat(old_balance_for_extra_pay) + interest;

      }
      else{

        Updated_EMI  = display_monthly_payment + parseFloat(ballon_amounts);

        if(Updated_EMI > old_balance_for_extra_pay){

          Updated_EMI = old_balance_for_extra_pay + interest;

        }



      }                 

    }
    else{

      Updated_EMI  = display_monthly_payment;

    } 


    if (setting_data.remove_decimal_point == 1) {
      table_data +=
      "<td>-" +
      currency_symbols +
      parseInt(Updated_EMI) +
      "</td>";
    } else {
      table_data +=
      "<td>-" +
      currency_symbols +
      parseFloat(Updated_EMI).toFixed(2) +
      "</td>";
    }

  }           


}else{

  if (setting_data.remove_decimal_point == 1) {
    table_data +=
    "<td>-" +
    currency_symbols +
    parseInt(display_monthly_payment) +
    "</td>";
  } else {
    table_data +=
    "<td>-" +
    currency_symbols +
    parseFloat(display_monthly_payment).toFixed(2) +
    "</td>";
  }

}

      /* EMI column of table code */


          /* extra payment column data for table entry */

if (setting_data.extra_payment_option == '1' && extra_payment > 0) {  

  if(parseInt(balance)<0){

    if(old_balance_for_extra_pay < display_monthly_payment){

      table_data +=
      "<td class='extra-payment-column'>-" +
      currency_symbols +
      "0" +
      "</td>";


    }
    else{

      var Updated_EMI = display_monthly_payment + parseInt(ballon_amounts);

      if(parseInt(ballon_amounts) > 0 && Updated_EMI > old_balance_for_extra_pay){

        table_data +=
        "<td class='extra-payment-column'>-" +
        currency_symbols +
        "0" +
        "</td>";

      }
      else{

        if(parseInt(ballon_amounts) > 0){

          var ext_pay = old_balance_for_extra_pay - (display_monthly_payment + parseInt(ballon_amounts) );

          if(ext_pay<0){
            ext_pay = 0;
          }

        }
        else{

          var ext_pay = old_balance_for_extra_pay - display_monthly_payment;

          if(ext_pay<0){
            ext_pay = 0;
          }

        }



        if(ext_pay < extra_payment){

          table_data +=
          "<td class='extra-payment-column'>-" +
          currency_symbols +
          parseInt(ext_pay+interest) +
          "</td>";

          total_extra_payment = parseInt(total_extra_payment) + parseInt(ext_pay+interest);

        }         
        else{ 

          table_data +=
          "<td class='extra-payment-column'>-" +
          currency_symbols +
          parseInt(extra_payment) +
          "</td>";

          total_extra_payment = parseInt(total_extra_payment) + parseInt(extra_payment);

        }

      }


    }


  }
  else{


    table_data +=
    "<td class='extra-payment-column'>-" +
    currency_symbols +
    parseInt(extra_payment) +
    "</td>";

    total_extra_payment = parseInt(total_extra_payment) + parseInt(extra_payment);

  }         

}

      /* extra payment column data for table entry */ 


if (setting_data.remove_decimal_point == 1) {
  table_data +=
  "<td>" +
  currency_symbols +
  parseInt(interest)
  "</td>";
} else {
  table_data +=
  "<td>" +
  currency_symbols +
 parseFloat(interest).toFixed(2)
  "</td>";
}

if (i == loan_terms_month) {
  balance = 0;
}
var display_balance = balance;
if (
  display_balance < 0 ||
  (display_balance > 0 && display_balance < 1)
  ) {
  display_balance = 0.0;
}
if (setting_data.remove_decimal_point == 1) {
  display_balance = parseInt(display_balance);
} else {
  display_balance = parseFloat(display_balance).toFixed(2);
}

if (parseInt(balance) < 0) {
  table_data += "<td>0.00</td>";
} else {
  table_data += "<td>" + currency_symbols + display_balance + "</td>";
}

table_data += "</tr>";

/* extra payment calculate total interest and break loop of table entry wnen balance get 0 */

if(setting_data.extra_payment_option == '1'){

   if (setting_data.remove_decimal_point == 1) {

     if (payment_type == "In Advance" && i==1) { 

         total_interest_for_extra_pay = parseInt(total_interest_for_extra_pay) + parseInt(interest);

     }
     else{
         total_interest_for_extra_pay = parseInt(total_interest_for_extra_pay) + parseInt(interest);
     }
   
  }
  else{

    if (payment_type == "In Advance" && i==1) { 

      total_interest_for_extra_pay = parseFloat(total_interest_for_extra_pay) + parseFloat(interest);

    }
    else{

        total_interest_for_extra_pay = parseFloat(total_interest_for_extra_pay) + parseFloat(interest); 
    }
              
  }


  if (parseInt(balance) < 0) {
   break;
  } 

}  

 /* extra payment calculate total interest and break loop of table entry wnen balance get 0 */



}




jQuery("#loan_table_data").html(table_data);



/* hide extra payment table column when its 0 */

if (setting_data.extra_payment_option == '1') {   

  if(parseInt(extra_payment)==0){
    jQuery('.extra-payment-column').hide(); 
  }
  else{
    jQuery('.extra-payment-column').show(); 
  }

}



/* extra payment display total interest in summary result */

if (setting_data.extra_payment_option == '1' && extra_payment > 0) {

  if (setting_data.remove_decimal_point == 1) {

    jQuery("#total_interests_amt").html(addCommas(total_interest_for_extra_pay));
    jQuery("#total_interests_amt_hidden").html(addCommas(total_interest_for_extra_pay));

  }
  else{

    jQuery("#total_interests_amt").html(addCommas(total_interest_for_extra_pay.toFixed(2)));
    jQuery("#total_interests_amt_hidden").html(addCommas(total_interest_for_extra_pay.toFixed(2)));

  }


  if (setting_data.hide_total_extra_payments != '1'){

    jQuery("#bottom_total_extra_payment").text(addCommas(total_extra_payment));

  }

  
  /* change total interest variable for chart */

  total_interests = total_interest_for_extra_pay; 


   /* saved interest after extra payment start */

  var total_interest_without_extra_payment = get_total_interest_without_extra_payment();
  
  total_interest_without_extra_payment = total_interest_without_extra_payment.replaceAll(",", "");

  
  var saved_inter_after_extra_payment = 0;  


  if(parseInt(total_interest_without_extra_payment) > 0){  

    if (setting_data.remove_decimal_point == 1) {

        saved_inter_after_extra_payment = parseInt(total_interest_without_extra_payment) - parseInt(total_interest_for_extra_pay);

    }
    else{

       saved_inter_after_extra_payment = parseFloat(total_interest_without_extra_payment) - parseFloat(total_interest_for_extra_pay);

       saved_inter_after_extra_payment = saved_inter_after_extra_payment.toFixed(2);
    } 

  }


  if(saved_inter_after_extra_payment < 0){
    saved_inter_after_extra_payment = 0;
  } 


   jQuery('#interest_save_for_extra_payment').html(addCommas(saved_inter_after_extra_payment));


  /* saved interest after extra payment end */

}

/* extra payment display total interest in summary result */






/* END : Loan Table Section */

/* START : Loan Chart Section */
var balance_arr = [];
var remainig_interests = [];
var total_monthly_payment = [];
var total_principal_amonut = [];
var balance = loan_amount;
var interestSum = 0;
var principalSum = 0;
var monthly_paymentSum = 0;

var graph_type = "Years";
if (loan_terms_month <= 12) {
  graph_type = "Months";
}
graph_type = "Months";

for (var p = 1; p <= loan_terms_month; p++) {
  if (p == 1) {
    if (setting_data.remove_decimal_point == 1) {
      remainig_interests.push(parseInt(total_interests));
      balance_arr.push(parseInt(balance));
    } else {
      remainig_interests.push(parseFloat(total_interests.toFixed(2)));
      balance_arr.push(parseFloat(balance.toFixed(2)));
    }
  }
  
  if (setting_data.remove_decimal_point == 1) {
    rmv_decimal = 1;
  } else {
    rmv_decimal = 0;
  }
  count = loan_terms_month - p;
  var interest = cal_interest_amount_by_fre_payment_option(
    repayment_frequency_val,
    count,
    balance,
    interest_rates,
    rmv_decimal
    );
  
  var principal = monthly_payment - parseFloat(interest).toFixed(2);
  
  if (p == loan_terms_month) {
    balance = balance - principal - ballon_amounts;
  } else {
    balance = balance - principal;
  }


      /* deduct extra payment from  balance in table entry */

  if (setting_data.extra_payment_option == '1') {        

    balance = balance - extra_payment; 
  }  

      /* deduct extra payment from  balance in table entry */

  
  var total_interests = total_interests - interest;
  if (balance < 0 || (balance > 0 && balance < 1)) {
    balance = 0;
  }
  if (
    total_interests < 0 ||
    (total_interests > 0 && total_interests < 1)
    ) {
    total_interests = 0;
}

 interestSum += interest;  // Accumulate interest
 principalSum += principal; 
 monthly_paymentSum += monthly_payment;

if (loan_terms_month > 120) {
  if (p % 12 == 0 || p == loan_terms_month) {
    if (setting_data.remove_decimal_point == 1) {
      /* remainig_interests.push(parseInt(total_interests));
      balance_arr.push(parseInt(balance)); */

      remainig_interests.push(parseInt(interestSum)); 
      balance_arr.push(parseInt(balance));
      total_monthly_payment.push(parseInt(monthly_paymentSum));
      total_principal_amonut.push(parseInt(monthly_paymentSum) - parseInt(interestSum));
    } else {
      remainig_interests.push(parseFloat(interestSum.toFixed(2)));
      balance_arr.push(parseFloat(balance.toFixed(2)));
      total_monthly_payment.push(parseFloat(monthly_paymentSum.toFixed(2)));
      total_principal_amonut.push(parseFloat(monthly_paymentSum.toFixed(2)) - parseFloat(interestSum.toFixed(2)));
    }
    interestSum = 0;
    //principalSum = 0;
    monthly_paymentSum = 0;
  }
} else {
  if (setting_data.remove_decimal_point == 1) {
    remainig_interests.push(parseInt(interest));
    if(setting_data.chart_types == 'stacked_bar'){
      balance_arr.push(parseInt(balance));
      total_monthly_payment.push(parseInt(monthly_paymentSum));
      total_principal_amonut.push(parseInt(monthly_paymentSum) - parseInt(interestSum));
    }else{
      balance_arr.push(parseInt(principal));
    }
  } else {
    remainig_interests.push(parseFloat(interest).toFixed(2));
    if(setting_data.chart_types == 'stacked_bar'){
      balance_arr.push(parseFloat(balance.toFixed(2)));
      total_monthly_payment.push(parseFloat(monthly_payment.toFixed(2)));
      total_principal_amonut.push(parseFloat(monthly_payment.toFixed(2)) - parseFloat(interest.toFixed(2)));
    }else{
      balance_arr.push(parseFloat(principal.toFixed(2)));
    }
  }
}
      // total_interests

       /* extra payment chart no of payments */

if (setting_data.extra_payment_option == '1' && parseInt(balance) <= 0 && extra_payment > 0) {         
 break; 
}
      /* extra payment chart no of payments */



}

/* START : PREPARE CHART JS DATA */
var loan_data = [];
const interests = [];
const total_balance_arr = [];
const xData = [];

/* new stacked bar chart */
//if(setting_data.chart_types == 'stacked_bar'){  
  const principal_calc_new_arr = [];
  const extra_payment_arr = [];
//}

for (var p = 1; p < remainig_interests.length; p++) {
  total_balance_arr.push(balance_arr[p]);
  if (setting_data.remove_decimal_point == 1) {
    interests.push(parseInt(remainig_interests[p]));
    /* new stacked bar chart */
    if(setting_data.chart_types == 'stacked_bar'){
      principal_calc_new_arr.push(parseInt(monthly_payment) - parseInt(remainig_interests[p]));
    }

  } else {
    interests.push(parseFloat(remainig_interests[p]));

    /* new stacked bar chart */
    if(setting_data.chart_types == 'stacked_bar'){
      principal_calc_new_arr.push(parseFloat(monthly_payment) - parseFloat(remainig_interests[p]));
    }

  }
  xData.push(p);

  /* new stacked bar chart */
  if(setting_data.chart_types == 'stacked_bar'){
    extra_payment_arr.push(extra_payment);
  }

}

var graphColor = $("#loan-process-graph").css("--calc-graph-color");
var graph_color_sub = $("#loan-process-graph").css(
  "--calc-graph-color-sub"
  );
var graph_border_color = $("#loan-process-graph").css(
  "--calc-graph-border-color"
  );
var graph_border_color_sub = $("#loan-process-graph").css(
  "--calc-graph-border-color-sub"
  );


/* new stacked bar chart */
if(setting_data.chart_types == 'stacked_bar'){

var balance_border_color_graph = $("#loan-process-graph").css(
  "--calc-graph-balance-border-color"
  );
var balance_point_background_color_graph = $("#loan-process-graph").css(
  "--calc-graph-balance-point-background-color"
  );
var extra_payment_graph_color = $("#loan-process-graph").css(
  "--calc-graph-extra-payment-graph-color"
  );

}

const colors = {
  green: {
    fill: "#e0eadf",
    stroke: "#5eb84d",
  },
  
  lightBlue: {
    stroke: "#6fccdd",
  },
  
  darkBlue: {
    fill: graphColor,
    stroke: graph_border_color,
  },
  
  purple: {
    fill: graph_color_sub,
    stroke: graph_border_color_sub,
  },
};

var data = {};

/* new stacked bar chart */

if(setting_data.chart_types == 'stacked_bar'){


  if (typeof balance_point_background_color_graph === 'undefined'){
      balance_point_background_color_graph = setting_data.balance_point_background_color_graph;
  }

  if (typeof balance_border_color_graph === 'undefined'){
      balance_border_color_graph = setting_data.balance_border_color_graph;
  }

  if (typeof extra_payment_graph_color === 'undefined'){
      extra_payment_graph_color = setting_data.extra_payment_graph_color;
  }


  var data_sets_graph = [

       {
          // label: "Balance",
          label: 'Balance',
          type:'line',
          fill: false,
          data: total_balance_arr,
          backgroundColor: balance_point_background_color_graph,
          pointBackgroundColor: balance_point_background_color_graph,
          borderColor: balance_border_color_graph,
          pointHighlightStroke: balance_point_background_color_graph,
          borderCapStyle: "butt",  
          pointRadius: 5
          
      },    
      {
            // label: "Principal",
        label: setting_data.principal_label,
        fill: true,
        backgroundColor: colors.darkBlue.fill,
        pointBackgroundColor: colors.darkBlue.stroke,
        borderColor: colors.darkBlue.stroke,
        pointHighlightStroke: colors.darkBlue.stroke,
        borderCapStyle: "butt",
        data: total_principal_amonut,
        yAxisID: 'y1'
        
      },  
      {
        //  label: "Interest",
        label: setting_data.interest_label,
        fill: true,
        backgroundColor: colors.purple.fill,
        pointBackgroundColor: colors.purple.stroke,
        borderColor: colors.purple.stroke,
        pointHighlightStroke: colors.purple.stroke,
        borderCapStyle: "butt",
        data: interests,
        yAxisID: 'y1'    
      } 
       
    ];


    if(extra_payment > 0){

          data_sets_graph.push({
            //  label: "Extra payment",
            label: setting_data.extra_payment_label,
            fill: true,
            backgroundColor: extra_payment_graph_color,
            pointBackgroundColor: colors.purple.stroke,
            borderColor: colors.purple.stroke,
            pointHighlightStroke: colors.purple.stroke,
            borderCapStyle: "butt",
            data: extra_payment_arr,
            yAxisID: 'y1'    
        });
    }

  data = {
  labels: xData,
  datasets: data_sets_graph  
  };

}else{

    data = {
    labels: xData,
    datasets: [
    {
          //  label: "Interest",
      label: setting_data.interest_label,
      fill: true,
      backgroundColor: colors.purple.fill,
      pointBackgroundColor: colors.purple.stroke,
      borderColor: colors.purple.stroke,
      pointHighlightStroke: colors.purple.stroke,
      borderCapStyle: "butt",
      data: interests,
    },
    
    {
          // label: "Principal",
      label: setting_data.principal_label,
      fill: true,
      backgroundColor: colors.darkBlue.fill,
      pointBackgroundColor: colors.darkBlue.stroke,
      borderColor: colors.darkBlue.stroke,
      pointHighlightStroke: colors.darkBlue.stroke,
      borderCapStyle: "butt",
      data: total_balance_arr,
    },
    ],
  };


}

Chart.Tooltip.positioners.custom = function (elements, position) {
      //debugger;
  return {
    x: position.x,
    y: position.y,
  };
};

var ctx = document.getElementById("loan-process-graph").getContext("2d");

var graph_new_theme = Chart.getChart("loan-process-graph");

if (graph_new_theme) {
  graph_new_theme.destroy();
}


/* new stacked bar chart */

if(setting_data.chart_types == 'stacked_bar'){  

  graph_new_theme = new Chart(ctx, {
      type: 'bar', 
      data: data,
      responsive: true,
      options: {  
        title: {
          display: true,
          text: "Loan Calculator",
        },
        layout: {
          padding: 32,
        },
        tooltips: {
          mode: "index",
          intersect: true,
          position: "custom",
          yAlign: "bottom",
        },      
        scales: {
          xAxes: {
            stacked: true, 
            gridLines: {
              display: false,
            },              
            scaleLabel: {
              display: true,
              labelString: "Term (Months)",
            },
            min: 1,
            title: {
                    display: true,
                    text: 'No. of Payments'
            },
          },          
          yAxes: {
            stacked: true, 
            beginAtZero: false, 
            gridLines: {
              display: true,
            },             
            scaleLabel: { 
              display: true,
              labelString: "Amount Owing ($)",
            }, 
            title: {
                display: true,
                text: 'Balance'
            }           
          },
          y1: { 
                type: 'linear',
                position: 'right',
                min: 0,                 
                title: {
                    display: true,
                    text: 'EMI Payment / '+repayment_frequency_val
                },
                stacked: true, 
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          datalabels : {
                display:false,
          },
          htmlLegend: {            
            containerID: 'lc-chart-legend-container',
          },          
          tooltip: {
              enabled: false, // Disable default tooltips
              external: function(context) {
                    // Tooltip Element
                    let tooltipEl = document.getElementById('chartjs-tooltip');                    
                    if (!tooltipEl) {
                        tooltipEl = document.createElement('div');
                        tooltipEl.id = 'chartjs-tooltip';
                        tooltipEl.innerHTML = '<table></table>';
                        document.body.appendChild(tooltipEl);
                    }                    
                    const tooltipModel = context.tooltip;
                    if (tooltipModel.opacity === 0) {
                        tooltipEl.style.opacity = 0;
                        return;
                    }                    
                    tooltipEl.classList.remove('above', 'below', 'no-transform');
                    if (tooltipModel.yAlign) {
                        tooltipEl.classList.add(tooltipModel.yAlign);
                    } else {
                        tooltipEl.classList.add('no-transform');
                    }
                    function getBody(bodyItem) {
                        return bodyItem.lines;
                    }                    
                    if (tooltipModel.body) {
                        const titleLines = tooltipModel.title || [];
                        const bodyLines = tooltipModel.body.map(getBody);

                        let innerHtml = '<div style="background-color:#fff;padding:10px;border:1px solid #ccc;">';

                        titleLines.forEach(function(title) {
                            innerHtml += '<p style="margin:0px;">No. Payment: ' + title + '</p>';
                        });
                        bodyLines.forEach(function(body, i) {     
                            innerHtml += '<p style="margin:0px;">' + body + '</p>';
                            if(body[0].split(':')[0]!='Balance'){

                              if(parseInt(extra_payment) > 0){                               

                                var total_payment_graph = monthly_payment+parseInt(extra_payment)

                                if(setting_data.remove_decimal_point=='1'){
                                  total_payment_graph = parseInt(total_payment_graph);
                                }
                                else{
                                  total_payment_graph = parseFloat(total_payment_graph).toFixed(2);  
                                }

                                innerHtml += '<p style="margin:0px;">Total Payment: '+total_payment_graph+'</p>';
                              }
                              else{                               
                                var totalpayment= (total_monthly_payment[i] != ''?total_monthly_payment[i]:monthly_payment);
                                innerHtml += '<p style="margin:0px;">Total Payment: '+totalpayment+'</p>';
                              }

                            }

                        });
                        innerHtml += '</div>';

                        let tableRoot = tooltipEl.querySelector('table');
                        tableRoot.innerHTML = innerHtml;
                    }

                    const position = context.chart.canvas.getBoundingClientRect();
                    const bodyFont = Chart.helpers.toFont(tooltipModel.options.bodyFont);
                    tooltipEl.style.opacity = 1;
                    tooltipEl.style.position = 'absolute';
                    tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
                    tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
                    tooltipEl.style.font = bodyFont.string;
                    tooltipEl.style.padding = tooltipModel.padding + 'px ' + tooltipModel.padding + 'px';
                    tooltipEl.style.pointerEvents = 'none';
                }
          },
        },
         onHover: function(event, chartElement) {
            const datasetIndex = chartElement[0]?.datasetIndex;            
            // Reset all dataset colors
            this.data.datasets.forEach((dataset, index) => {
                dataset.backgroundColor = index === datasetIndex
                    ? dataset.backgroundColor.replace(/0\.2/, '0.9') // Highlight
                    : dataset.backgroundColor.replace(/0\.9/, '0.2'); // Reset
            });

            // Re-render the chart
            this.update();
        }
      },
      plugins: [htmlLegendPlugin],
    });

}
else{ 

  var intersectValue = setting_data.chart_types == "bar" ? { intersect: false, mode: 'index' } : { intersect: true, mode: 'nearest' }; // default values
    graph_new_theme = new Chart(ctx, {
    type: setting_data.chart_types,
    data: data,
    responsive: true,
    options: {
      title: {
        display: true,
        text: "Loan Calculator",
      },
      interaction: intersectValue,
      layout: {
        padding: 32,
      },
      tooltips: {
        mode: "index",
        intersect: true,
        position: "custom",
        yAlign: "bottom",
      },
      scales: {
        xAxes: [
        {
          stacked: true,
          gridLines: {
            display: false,
          },
            // display:false,
          scaleLabel: {
            display: true,
            labelString: "Term (Months)",
          },
        },
        ],
        yAxes: [
        {
          stacked: true,
          gridLines: {
            display: false,
          },
            // display:false,

          scaleLabel: {
            display: true,
            labelString: "Amount Owing ($)",
          },
        },
        ],
      },
      plugins:{
           datalabels : {
                display:false,
              },
      }
    },
  });

}

/* END : PREPARE CHART JS DATA */

  /* extrapayment code to deduct time frequency in summary result */
  if (setting_data.extra_payment_option == '1' && extra_payment > 0) {
      convert_total_terms_to_year_month(loan_terms_month,repayment_frequency_val);
  } 


   /* Summary Chart Break-up of Total Payment */   


    if(setting_data.summary_chart_option == '1'){
      
      var break_up_chart_data = {};
      break_up_chart_data['total_principal'] = parseFloat(principalSum).toFixed(2);
      break_up_chart_data['total_interest'] = jQuery("#total_interests_amt_hidden").text();
      break_up_chart_data['down_payment'] = jQuery("#down_payment").val();
      break_up_chart_data['total_extra_payment'] = jQuery("#bottom_total_extra_payment").text();
      break_up_chart_data['ballon_amount'] = jQuery("#ballon_amounts").val(); 
      break_up_of_total_payment_chart(break_up_chart_data);

    }
      
    /* Summary Chart Break-up of Total Payment */


} /* END : Loan Calculation Process */

    /* START : Textbox Blur Event*/
jQuery("#loan_amount").blur(function () {
  var currency_symbol = setting_data.currency_symbols;
  var loan_amount = jQuery("#loan_amount")
  .val()
  .replaceAll(currency_symbol, "");
  jQuery("#loan_amount").val(
    addCommas(jQuery("#loan_amount").val().replaceAll(currency_symbol, ""))
    );
  loan_amount = loan_amount.replaceAll(",", "");
  if (loan_amount == "" || loan_amount == ".") {
    jQuery("#loan_amount").val(
      addCommas(setting_data.loan_amount_min_value)
      );
  }
  if (parseFloat(loan_amount) < setting_data.loan_amount_min_value) {
    jQuery("#loan_amount").val(
      addCommas(setting_data.loan_amount_min_value)
      );
  }
  if (parseFloat(loan_amount) >= setting_data.loan_amount_max_value) {
    jQuery("#loan_amount").val(
      addCommas(setting_data.loan_amount_max_value)
      );
  }
  var loan_amount = jQuery("#loan_amount")
  .val()
  .replaceAll(currency_symbol, "");
  
  loan_amount = loan_amount
  .replaceAll(",", "")
  .replaceAll(currency_symbol, "");

  if (setting_data.down_payment_option == '1') {
    jQuery("#loan_amount").val(addCommas(parseInt(loan_amount)));   
  } 
  
  jQuery("#loan_amount_range").val(parseFloat(loan_amount));
  loan_calculation_process();
});

jQuery("#loan_terms").on("blur", function () {
    /*on filled input check min max values*/
  var repayment_freq = jQuery("#repayment_freq option:selected").val();
  var old_repayment_freq = jQuery(
    "input[name='current_repayment_freq']"
    ).val();
  var default_nop_value = jQuery("input[name='loan_terms']").val();
  /* visible note below chart */
  if(default_nop_value > 120){
    jQuery('body').find('.chart-note').show();
  }else{
    jQuery('body').find('.chart-note').hide();
  }
  /* nop = number of payments */
  var min_nop_value = jQuery("input[name='min_value']").val();
  var max_nop_value = jQuery("input[name='max_value']").val();
  
  var numbers_of_payments = cal_numbers_of_payment_by_frequency_val(
    repayment_freq,
    old_repayment_freq,
    default_nop_value,
    min_nop_value,
    max_nop_value
    );
  
  var loan_terms = jQuery("#loan_terms").val();
  jQuery("input[name='current_repayment_freq']").val(repayment_freq);
  
  if (loan_terms == "" || loan_terms == ".") {
    jQuery("#loan_terms").val(numbers_of_payments.nop_min_value);
  }
  
  if (parseFloat(loan_terms) < numbers_of_payments.nop_min_value) {
    jQuery("#loan_terms").val(numbers_of_payments.nop_min_value);
  }
  if (parseFloat(loan_terms) > numbers_of_payments.nop_max_value) {
    jQuery("#loan_terms").val(numbers_of_payments.nop_max_value);
  }
  if (setting_data.disable_ballon_amt !== "1") {
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    if (
      parseFloat(ballon_amount_range.value) == 0 ||
      parseInt(ballon_amount_range.value) == 0
      ) {
      document.getElementById("ballon_amounts").value = 0 + "%";
    document.getElementById("ballon_amounts_per").value = 0 + "%";
    document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
  }
}

jQuery("#loan_terms_range").val(jQuery("#loan_terms").val());
var monthly_fee = jQuery("#monthly_fee").val();
var application_fee = jQuery("#application_fee").val();
var loan_terms = jQuery("#loan_terms").val();
var total_regular_fee_amt = parseFloat(loan_terms) * 120;
jQuery("#total_regular_fee_amt").html(total_regular_fee_amt);
if (setting_data.remove_decimal_point == 1) {
  var total_fee =
  parseInt(application_fee) + parseInt(total_regular_fee_amt);
} else {
  var total_fee =
  parseFloat(application_fee) + parseFloat(total_regular_fee_amt);
}

jQuery("#total_fee_amt").html(total_fee);
loan_calculation_process();
});

jQuery("#interest_rates").blur(function () {
  var interest_rates = jQuery("#interest_rates")
  .val()
  .replaceAll("%", "");
  if (setting_data.remove_decimal_point == 1) {
    if (interest_rates == "" || interest_rates == ".") {
      jQuery("#interest_rates").val(parseInt(setting_data.interested_rate));
    }
    if (parseFloat(interest_rates) < setting_data.interest_rate_min_value) {
      jQuery("#interest_rates").val(
        parseInt(setting_data.interest_rate_min_value)
        );
    }
    if (parseFloat(interest_rates) > setting_data.interest_rate_max_value) {
      jQuery("#interest_rates").val(
        parseInt(setting_data.interest_rate_max_value)
        );
    }
  } else {
    if (
      interest_rates == "" ||
      interest_rates == "." ||
      isNaN(interest_rates)
      ) {
      jQuery("#interest_rates").val(
        parseFloat(setting_data.interested_rate).toFixed(2)
        );
  }
  if (parseFloat(interest_rates) < setting_data.interest_rate_min_value) {
    jQuery("#interest_rates").val(
      parseFloat(setting_data.interest_rate_min_value).toFixed(2)
      );
  }
  if (parseFloat(interest_rates) > setting_data.interest_rate_max_value) {
    jQuery("#interest_rates").val(
      parseFloat(setting_data.interest_rate_max_value).toFixed(2)
      );
  }
}

var interest_rates = jQuery("#interest_rates").val();

if (setting_data.remove_decimal_point == 1) {
  jQuery("#interest_rates").val(parseInt(interest_rates));
} else {
  jQuery("#interest_rates").val(parseFloat(interest_rates).toFixed(2));
}

jQuery("#interest_rate_range").val(jQuery("#interest_rates").val());
jQuery("#interest_rate_range_dis").html(
  jQuery("#interest_rates").val() + "%"
  );
loan_calculation_process();
});
jQuery("#ballon_amounts_per").blur(function () {
  if (jQuery("#extra_payment").length) {
    jQuery("#extra_payment").val(0);   
    jQuery("#extra_payment_range").val(0);   
  }
  var currency_symbol = setting_data.currency_symbols;
  jQuery("#ballon_amount_range").val(
    jQuery("#ballon_amounts_per").val().replaceAll("%", "")
    );
  var loan_amount = jQuery("#loan_amount")
  .val()
  .replaceAll(currency_symbol, "");
  loan_amount = loan_amount.replaceAll(",", "");
  var ballon_amounts_per = jQuery("#ballon_amounts_per")
  .val()
  .replaceAll("%", "");

  if(parseInt(ballon_amounts_per) > 80){
      jQuery("#ballon_amounts_per").val(80);
      ballon_amounts_per = 80;
  }  
  
  if (setting_data.remove_decimal_point == 1) {
    var ballon_amounts =
    parseInt(parseInt(loan_amount) * parseInt(ballon_amounts_per)) / 100;
  } else {
    var ballon_amounts =
    parseFloat(parseFloat(loan_amount) * parseFloat(ballon_amounts_per)) /
    100;
  }
  
  if (ballon_amounts_per == "" || ballon_amounts_per == ".") {
    jQuery("#ballon_amounts_per").val(
      setting_data.default_balloon_amount + "%"
      );
    jQuery("#ballon_amount_range").val(setting_data.default_balloon_amount);
    ballon_amounts_per = setting_data.default_balloon_amount;
  }
  
  jQuery("#ballon_amounts").val(ballon_amounts);
  jQuery("#bill_ballon_amt").html(ballon_amounts);
  jQuery("#interest_rate_range_dis").html(
    jQuery("#interest_rates").val() + "%"
    );
  jQuery("#ballon_amounts_per_dis").html(ballon_amounts_per + "%");
  loan_calculation_process();
});

jQuery("#ballon_amounts").blur(function () {
  var currency_symbol = setting_data.currency_symbols;
  jQuery("#ballon_amount_range").val(
    jQuery("#ballon_amounts_per").val().replaceAll("%", "")
    );
  var loan_amount = jQuery("#loan_amount")
  .val()
  .replaceAll(currency_symbol, "");
  loan_amount = loan_amount.replaceAll(",", "");
  var ballon_amounts = jQuery("#ballon_amounts").val();
  if (ballon_amounts == "" || ballon_amounts == ".") {
    jQuery("#ballon_amounts").val(0);
  }
  
  ballon_amounts = ballon_amounts.replaceAll(",", "");
  
  if (ballon_amounts == "" || ballon_amounts == ".") {
    ballon_amounts = 0;
    ballon_amounts_per = 0;
  } else {
    if (setting_data.remove_decimal_point == 1) {
      var ballon_amounts_per = parseInt(
        (parseInt(ballon_amounts) * 100) / parseInt(loan_amount)
        );
    } else {
      var ballon_amounts_per = parseFloat(
        (parseFloat(ballon_amounts) * 100) / parseFloat(loan_amount)
        );
    }
  }
  
  jQuery("#ballon_amounts_per").val(ballon_amounts_per);
  jQuery("#ballon_amount_range").val(ballon_amounts_per);
  jQuery("#bill_ballon_per").val(ballon_amounts_per);
  jQuery("#bill_ballon_amt").html(ballon_amounts);
  jQuery("#bill_ballon_per").html(ballon_amounts_per);
  jQuery("#ballon_amounts_per_dis").html(ballon_amounts_per + "%");
  loan_calculation_process();
});
    /* END : Textbox Blur Event*/

var loan_amount_range = document.getElementById("loan_amount_range");
jQuery("#loan_amount").val(addCommas(loan_amount_range.value)); // Display the default slider value
if (setting_data.remove_decimal_point == 1) {
  var value = parseInt(
    ((loan_amount_range.value - loan_amount_range.min) /
      (loan_amount_range.max - loan_amount_range.min)) *
    100
    );
} else {
  var value = parseFloat(
    ((loan_amount_range.value - loan_amount_range.min) /
      (loan_amount_range.max - loan_amount_range.min)) *
    100
    );
}
loan_amount_range.style.background =
"linear-gradient(to right, #555555 0%, #555555 " +
value +
"%, #fff " +
value +
"%, " +
setting_data.back_ground_color +
" 100%)";

    // Update the current slider value (each time you drag the slider handle)
loan_amount_range.oninput = function () {
  jQuery("#loan_amount").val(addCommas(this.value));
  loan_calculation_process();
};

var loan_terms_range = document.getElementById("loan_terms_range");
    jQuery("#loan_terms").val(loan_terms_range.value); // Display the default slider value
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((loan_terms_range.value - loan_terms_range.min) /
          (loan_terms_range.max - loan_terms_range.min)) *
        100
        );
    } else {
      var value = parseFloat(
        ((loan_terms_range.value - loan_terms_range.min) /
          (loan_terms_range.max - loan_terms_range.min)) *
        100
        );
    }
    loan_terms_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";

    // Update the current slider value (each time you drag the slider handle)
    loan_terms_range.oninput = function () {
      jQuery("#loan_terms").val(this.value);
      if (setting_data.remove_decimal_point == 1) {
        var value = parseInt(
          ((this.value - this.min) / (this.max - this.min)) * 100
          );
      } else {
        var value = parseFloat(
          ((this.value - this.min) / (this.max - this.min)) * 100
          );
      }
      this.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)";
      loan_calculation_process();
    };

    var interest_rate_range = document.getElementById("interest_rate_range");
    if (setting_data.remove_decimal_point == 1) {
      var interest_rate_range_val = parseInt(interest_rate_range.value);
      jQuery("#interest_rates").val(interest_rate_range_val);
    } else {
      var interest_rate_range_val = parseFloat(interest_rate_range.value);
      jQuery("#interest_rates").val(interest_rate_range_val.toFixed(2));
    }
    jQuery("#interest_rate_range_dis").html(
      interest_rate_range.value + "%"
      );
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((interest_rate_range.value - interest_rate_range.min) /
          (interest_rate_range.max - interest_rate_range.min)) *
        100
        );
    } else {
      var value = parseFloat(
        ((interest_rate_range.value - interest_rate_range.min) /
          (interest_rate_range.max - interest_rate_range.min)) *
        100
        );
    }
    interest_rate_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";
    // Update the current slider value (each time you drag the slider handle)
    interest_rate_range.oninput = function () {
      var interest_rate_range_val = this.value;
      jQuery("#interest_rates").val(interest_rate_range_val);
      jQuery("#interest_rate_range_dis").html(this.value + "%");
      if (setting_data.remove_decimal_point == 1) {
        var value = parseInt(
          ((this.value - this.min) / (this.max - this.min)) * 100
          );
      } else {
        var value = parseFloat(
          ((this.value - this.min) / (this.max - this.min)) * 100
          );
      }
      this.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)";
      loan_calculation_process();
    };

    var ballon_amount_range = document.getElementById("ballon_amount_range");
    jQuery("#ballon_amounts_per").val(ballon_amount_range.value);
    jQuery("#ballon_amounts_per_dis").html(ballon_amount_range.value + "%");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((ballon_amount_range.value - ballon_amount_range.min) /
          (ballon_amount_range.max - ballon_amount_range.min)) *
        100
        );
    } else {
      var value = parseFloat(
        ((ballon_amount_range.value - ballon_amount_range.min) /
          (ballon_amount_range.max - ballon_amount_range.min)) *
        100
        );
    }
    ballon_amount_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";

    // Update the current slider value (each time you drag the slider handle)
    ballon_amount_range.oninput = function () {
      if (jQuery("#extra_payment").length) {
        jQuery("#extra_payment").val(0);   
        jQuery("#extra_payment_range").val(0);   
      }
      jQuery("#ballon_amounts_per").val(this.value);
      jQuery("#ballon_amounts_per_dis").html(this.value + "%");
      if (setting_data.remove_decimal_point == 1) {
        var value = parseInt(
          ((this.value - this.min) / (this.max - this.min)) * 100
          );
      } else {
        var value = parseFloat(
          ((this.value - this.min) / (this.max - this.min)) * 100
          );
      }
      this.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)";
      loan_calculation_process();
    };

    /*************** || Print Code [PDF] || *****************/
    
     /* fixed issue of chart in print start */
    
  //   jQuery(".print-table").click(function () {

  //    var graphW = jQuery('#loan-process-graph').attr('width');     

  //    if(graphW == '0'){       
  //     jQuery('#loan-process-graph').prop('width',464);
  //     jQuery('#loan-process-graph').prop('height',697);       
  //   }

  //   printJS({
  //     printable: 'main-sec',
  //     type: 'html',
  //     targetStyles: ['*'], 

  //   });
  // });  

    function switchTabnewtheme(tabId) {
      if (tabId === 'tab1') {
        jQuery('#tab1').prop('checked', true).trigger('click');
      } else if (tabId === 'tab2') {
        jQuery('#tab1').prop('checked', true).trigger('click');
        setTimeout(function() {
          jQuery('#tab2').prop('checked', true).trigger('click');
        }, 10);
      } else if (tabId === 'tab3') {
        jQuery('#tab1').prop('checked', true).trigger('click');
        setTimeout(function() {
          jQuery('#tab3').prop('checked', true).trigger('click');
        }, 10);
      }
    }

    /*jQuery(".print-table").on('click', function () {
  // Show the loader and gray-out background
      jQuery('#overlay').show();

      var selectedTabIdsnewtheme = jQuery('input[name="tabs"]:checked').attr('id');
      switchTabnewtheme(selectedTabIdsnewtheme);

  // Apply print styles
      jQuery("#main-sec").css({
        "@media print": {
          "@page": { size: "297mm 420mm" },
          "-webkit-print-color-adjust": "exact !important",
          "-moz-print-color-adjust": "exact !important",
          "-ms-print-color-adjust": "exact !important",
          "print-color-adjust": "exact !important",
          "color-adjust": "exact !important"
        }
      });

      setTimeout(function() {
        jQuery('#overlay').hide();
    jQuery("#main-sec").print();

    // Hide the loader and gray-out background after printing
      }, 50);
    });*/

    jQuery('.print-table').on('click', function () {
      window.print();
    });

// Optional: Show loader when input focus out
    jQuery('input[name="tabs"]').on('focusout', function () {
      jQuery('#overlay').show();
    });

    jQuery('input:radio[name="tabs"]').on('change',function() {         
      loan_calculation_process();
    });

   /* fixed issue of chart in print end */  

    
    // Attach change event handler to the payment_type dropdown
    $("#payment_type").change(function () {
    // Call loan_calculation_process when the dropdown changes
      loan_calculation_process();
    });
    $(document).on("input", "#repayment_freq", function () {
      var repayment_freq = jQuery("#repayment_freq option:selected").val();
      var old_repayment_freq = jQuery(
        "input[name='current_repayment_freq']"
        ).val();

      var default_nop_value = jQuery("input[name='loan_terms']").val();
    /* nop = number of payments */
      var min_nop_value = jQuery("input[name='min_value']").val();
      var max_nop_value = jQuery("input[name='max_value']").val();
      var numbers_of_payments = cal_numbers_of_payment_by_frequency_val(
        repayment_freq,
        old_repayment_freq,
        default_nop_value,
        min_nop_value,
        max_nop_value
        );

    /*set payments range and min / max values in input range*/
      jQuery("#loan_terms_range").attr(
        "value",
        numbers_of_payments.nop_default_value
        );
      jQuery("#loan_terms_range").attr(
        "min",
        numbers_of_payments.nop_min_value
        );
      jQuery("#loan_terms_range").attr(
        "max",
        numbers_of_payments.nop_max_value
        );
      jQuery("#loan_terms").val(numbers_of_payments.nop_default_value);

      jQuery("input[name='min_value']").val(numbers_of_payments.nop_min_value);
      jQuery("input[name='max_value']").val(numbers_of_payments.nop_max_value);
      jQuery("input[name='default_value']").val(
        numbers_of_payments.nop_default_value
        );

    /*reset range slider after select payment frequency option last changes*/
      document.getElementById("loan_terms_range").value =
      numbers_of_payments.nop_default_value;

      var loan_terms_range = document.getElementById("loan_terms_range");
      var value1 =
      ((numbers_of_payments.nop_default_value -
        numbers_of_payments.nop_min_value) /
      (numbers_of_payments.nop_max_value -
        numbers_of_payments.nop_min_value)) *
      100;

      loan_terms_range.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value1 +
      "%, #fff " +
      value1 +
      "%, " +
      setting_data.back_ground_color +
      " 100%)";
      loan_calculation_process();
    });


     /* down payment event code start */

    if (setting_data.down_payment_option == '1') {        

       /* check if down payment value entered */
     jQuery("#down_payment").on("blur", function () {         

      if(setting_data.down_payment_mode=='percentage'){           

        var down_payment_range = document.getElementById("down_payment_range");
        if (parseFloat(down_payment_range.value) == 0 || parseInt(down_payment_range.value) == 0 ) {
          document.getElementById("down_payment").value = 0 ;
          document.getElementById("down_payment_per").value = 0 + "%";
          document.getElementById("down_payment_per_dis").text = 0 + "%";
        }
        var down_payment = $(this).val();
        var down_payment_per = jQuery("#down_payment_per").val();
        down_payment_range.value = down_payment_per;
        var loan_amount = jQuery("#loan_amount").val();
        loan_amount = loan_amount.replaceAll(",", "");

        if (down_payment == "" || down_payment == ".") {
          jQuery("#down_payment").val(0);
        }

        down_payment = down_payment.replaceAll(",", "");

        if (down_payment == "" || down_payment == ".") {
          down_payment = 0;
          down_payment_per = 0;
        } else {
          if (setting_data.remove_decimal_point == 1) {
            var down_payment_per = parseInt(
              (parseInt(down_payment) * 100) / parseInt(loan_amount)
              );
          } else {
            var down_payment_per = parseFloat(
              (parseFloat(down_payment) * 100) / parseFloat(loan_amount)
              );
          }
        }
        jQuery("#down_payment_per").val(Math.round(down_payment_per));
        document.getElementById("down_payment_range").value = down_payment_per;
        jQuery("#down_payment_per").val(down_payment_per);

        jQuery("#bottom_down_payment").html(down_payment);
        jQuery("#bottom_down_payment_per").html(down_payment_per);


      }
      else{ 

        var down_payment = $(this).val();
        var loan_amount = jQuery("#loan_amount").val();
        var currency_symbol = setting_data.currency_symbols;

        down_payment = down_payment.replaceAll(",", "");
        loan_amount = loan_amount.replaceAll(",", "");
        loan_amount = loan_amount.replaceAll(currency_symbol, "");


        if (setting_data.remove_decimal_point == 1) {             

          var eighty_percent_loan_amt =   (parseInt(loan_amount) * parseInt(setting_data.down_payment_max_per))/100;  
          down_payment = parseInt(down_payment);

          if(down_payment>eighty_percent_loan_amt){

            jQuery(this).val(0);

          }
          else{               

            jQuery(this).val(parseInt(down_payment));

            jQuery("#bottom_down_payment").html(parseInt(down_payment));

          }             

        }
        else{

          var eighty_percent_loan_amt =   (parseFloat(loan_amount) * parseInt(setting_data.down_payment_max_per))/100;  
          down_payment = parseFloat(down_payment);
          if(down_payment>eighty_percent_loan_amt){
            jQuery(this).val(0.00);

          }
          else{

            jQuery("#bottom_down_payment").html(down_payment);

          }
        }
        

        loan_calculation_process();

      }


    });       
     



     if(setting_data.down_payment_mode=='percentage'){ 

        /* check if down payment per changed */

      jQuery("#down_payment_per").on("blur", function () {  


        jQuery(this).val(parseInt(jQuery(this).val()));         

        if(parseInt(jQuery(this).val()) > setting_data.down_payment_max_per){

          if (setting_data.remove_decimal_point == 1) {
            jQuery(this).val(0);
          }
          else{
            jQuery(this).val(0.00);
          }
        }


        var currency_symbol = setting_data.currency_symbols;
        jQuery("#down_payment_range").val(
          jQuery("#down_payment_per").val().replaceAll("%", "")
          );
        var loan_amount = jQuery("#loan_amount")
        .val()
        .replaceAll(currency_symbol, "");
        loan_amount = loan_amount.replaceAll(",", "");
        var down_payment_per = jQuery("#down_payment_per")
        .val()
        .replaceAll("%", "");

        if (setting_data.remove_decimal_point == 1) {

          var down_payment =
          parseInt(parseInt(loan_amount) * parseInt(down_payment_per)) / 100;
        } else {
          var down_payment =
          parseFloat(parseFloat(loan_amount) * parseFloat(down_payment_per)) /
          100;
        }

        if (down_payment_per == "" || down_payment_per == ".") {
          jQuery("#down_payment_per").val("0%");
          jQuery("#down_payment_range").val(0);
          down_payment_per = 0;
        }


        jQuery("#down_payment").val(down_payment);
        jQuery("#bottom_down_payment").html(down_payment);


        jQuery("#down_payment_per_dis").html(down_payment_per + "%");
        loan_calculation_process();

      });    

      

      var down_payment_range = document.getElementById("down_payment_range");
      jQuery("#down_payment_per").val(down_payment_range.value);
      jQuery("#down_payment_per_dis").html(down_payment_range.value + "%");
      if (setting_data.remove_decimal_point == 1) {
        var value = parseInt(
          ((down_payment_range.value - down_payment_range.min) /
            (down_payment_range.max - down_payment_range.min)) *
          100
          );
      } else {
        var value = parseFloat(
          ((down_payment_range.value - down_payment_range.min) /
            (down_payment_range.max - down_payment_range.min)) *
          100
          );
      }
      down_payment_range.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, white 100%)";

        // Update the current slider value (each time you drag the slider handle)
      down_payment_range.oninput = function (e) {         
        jQuery("#down_payment_per").val(this.value);
        jQuery("#down_payment_per_dis").html(this.value + "%");
        if (setting_data.remove_decimal_point == 1) {
          value = parseInt(
            ((this.value - this.min) / (this.max - this.min)) * 100
            );
        } else {
          value = parseFloat(
            ((this.value - this.min) / (this.max - this.min)) * 100
            );
        }
        this.style.background =
        "linear-gradient(to right, #555555 0%, #555555 " +
        value +
        "%, #fff " +
        value +
        "%, white 100%)";
        loan_calculation_process();
      };  

    }


  }

     /* down payment event code end */


     /* extra payment event code start */ 

  if (setting_data.extra_payment_option == '1') {      

       /* check if down payment value entered */
   jQuery("#extra_payment").on("blur", function () {
    if (jQuery("#ballon_amounts").length) {
      jQuery("#ballon_amounts").val(0);
      jQuery("#ballon_amounts_per").val(0);   
      jQuery("#ballon_amount_range").val(0);   
    }
    var extra_payment = $(this).val();
    var loan_amount = jQuery("#loan_amount").val();

    extra_payment = extra_payment.replaceAll(",", "");
    loan_amount = loan_amount.replaceAll(",", "");  
    var extra_payment_max_per = parseInt(setting_data.extra_payment_max_per);

    var extra_payment_max_val = parseInt((parseInt(loan_amount) * extra_payment_max_per) / 100);            

    extra_payment = parseInt(extra_payment);
    if(extra_payment>extra_payment_max_val){
      jQuery(this).val(0);
      document.getElementById("extra_payment_range").value = 0;             
    }
    else{
      jQuery(this).val(addCommas(parseInt(extra_payment))); 
      jQuery("#bottom_extra_payment").html(extra_payment);
      document.getElementById("extra_payment_range").value = extra_payment;
    } 

    loan_calculation_process();

  });


   var extra_payment_range = document.getElementById("extra_payment_range");
   jQuery("#extra_payment").val(addCommas(extra_payment_range.value));


   var value = parseInt(
    ((extra_payment_range.value - extra_payment_range.min) /
      (extra_payment_range.max - extra_payment_range.min)) *
    100
    );

   extra_payment_range.style.background =
   "linear-gradient(to right, #555555 0%, #555555 " +
   value +
   "%, #fff " +
   value +
   "%, white 100%)";

      // Update the current slider value (each time you drag the slider handle)
   extra_payment_range.oninput = function (e) {
    if (jQuery("#ballon_amounts").length) {
      jQuery("#ballon_amounts").val(0);
      jQuery("#ballon_amounts_per").val(0);   
      jQuery("#ballon_amount_range").val(0);   
    }
    jQuery("#extra_payment").val(addCommas(this.value));       

    value = parseInt(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );        

    this.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, white 100%)";
    loan_calculation_process();
  };

}   

/* extra payment event code end */

loan_calculation_process(); // call function

} else {
    /*****************************************************************************************/
    /******************* START : Condition For Default theme *********************************/
    /*****************************************************************************************/

  function loan_calculation_process() {     

    var monthly_payment = 0;
    var repayment_frequency_val = jQuery("#repayment_freq").val();

    jQuery("input[name='current_repayment_freq']").val(
      repayment_frequency_val
      );  
    
    var default_nop_value = jQuery("input[name='loan_terms']").val();
    /* visible note below chart */
    if(default_nop_value > 120){
      jQuery('body').find('.chart-note').show();
    }else{
      jQuery('body').find('.chart-note').hide();
    }
    var loan_amount = jQuery("#loan_amount").val();
    if (setting_data.remove_decimal_point == 1) {
      loan_amount = parseInt(loan_amount.replaceAll(",", ""));
    } else {
      loan_amount = parseFloat(loan_amount.replaceAll(",", ""));
    }


    /* down payment code start */

    if (setting_data.down_payment_option == '1') {  

      if (setting_data.down_payment_mode == 'percentage') {

        document.getElementById("down_payment_range").max = setting_data.down_payment_max_per; 

        var down_payment_range = document.getElementById("down_payment_range");
        
        if (setting_data.remove_decimal_point == 1) {
          var value = parseInt(
            ((down_payment_range.value - down_payment_range.min) /
              (down_payment_range.max - down_payment_range.min)) *
            100
            );
          down_payment_range.style.background =
          "linear-gradient(to right, #555555 0%, #555555 " +
          value +
          "%, #fff " +
          value +
          "%, " +
          setting_data.back_ground_color +
          " 100%)";    
        } else {
          var value =
          ((down_payment_range.value - down_payment_range.min) /
            (down_payment_range.max - down_payment_range.min)) *
          100;
          down_payment_range.style.background =
          "linear-gradient(to right, #555555 0%, #555555 " +
          value +
          "%, #fff " +
          value +
          "%, " +
          setting_data.back_ground_color +
          " 100%)";    
        }


        var down_payment_per = jQuery("#down_payment_per").val();

        
        down_payment_per = parseInt(down_payment_per);
        jQuery("#down_payment_per_dis").html(down_payment_per + "%"); 
        
        var down_payment =
        parseInt(
          (parseInt(loan_amount) *
            parseInt(down_payment_per)
            )) / 100;

        loan_amount = loan_amount - parseInt(down_payment);

        jQuery("#bottom_down_payment_per").html(parseInt(down_payment_per));
        jQuery("#bottom_down_payment").html(addCommas(parseInt(down_payment)));
        jQuery("#down_payment").val(addCommas(parseInt(down_payment)));       


      }
      else{

        var down_payment = parseInt(jQuery("#down_payment").val().replaceAll(",", ""));     

        if(isNaN(down_payment)){

          jQuery("#down_payment").val('');
        }
        else if(down_payment >= loan_amount){
          jQuery("#down_payment").val('');
        } 
        else if (down_payment >  0 && down_payment < loan_amount) { 

          loan_amount = loan_amount - parseInt(down_payment);

        }

      }   
      


      if (down_payment == "") {
        down_payment = 0;
      }
      if (down_payment > 0) {
        jQuery("#down_payment_section").show();
      } else {
        jQuery("#down_payment_section").hide();
      }

    }   


    /* down payment code end */


    /* extra payment code start */

    if (setting_data.extra_payment_option == '1') {       

      var extra_payment = parseInt(jQuery("#extra_payment").val().replaceAll(",", ""));     

      if(isNaN(extra_payment)){
        jQuery("#extra_payment").val(0);
        extra_payment = 0;
        document.getElementById("extra_payment_range").value = 0; 
      }
      else if(extra_payment > loan_amount){
        jQuery("#extra_payment").val(0);
        extra_payment = 0;
        document.getElementById("extra_payment_range").value = 0; 
      } 


      if (extra_payment == "") {
        extra_payment = 0;
      }

      var extra_payment_max_per = parseInt(setting_data.extra_payment_max_per);

      var extra_payment_max_val =  parseInt((loan_amount * extra_payment_max_per) / 100);

      document.getElementById("extra_payment_range").max = extra_payment_max_val; 

      var extra_payment_range = document.getElementById("extra_payment_range");

      var value = parseInt(
        ((extra_payment_range.value - extra_payment_range.min) /
          (extra_payment_range.max - extra_payment_range.min)) *
        100
        );
      extra_payment_range.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)"; 

      if (extra_payment > 0) {
        jQuery("#extra_payment_section").show();
        jQuery("#bottom_extra_payment").html(addCommas(parseInt(extra_payment)));
        jQuery("#extra_payment_saved_time_section").show();
        jQuery("#extra_payment_total_section").show();
        jQuery("#extra_payment_saved_interest_section").show();
      } else {
        jQuery("#extra_payment_section").hide();
        jQuery("#extra_payment_saved_time_section").hide();
        jQuery("#extra_payment_total_section").hide();
        jQuery("#extra_payment_saved_interest_section").hide();
        jQuery("#bottom_total_extra_payment").text('');
      }

    }   


    /* extra payment code end */


    if (setting_data.remove_decimal_point == 1) {
      var interest_rates = parseInt(jQuery("#interest_rates").val());
    } else {
      var interest_rates = parseFloat(jQuery("#interest_rates").val());
    }

    var ballon_amounts_per = jQuery("#ballon_amounts_per").val();
    var loan_terms_month = 0;
    var total_months_terms = 0;
    jQuery("#loan_terms").val(Math.round(jQuery("#loan_terms").val()));

    var loan_terms = parseFloat(jQuery("#loan_terms").val()); 


    if (loan_terms > 0) {
      total_months_terms = cal_loan_terms_by_frequency_payment_option(
        repayment_frequency_val,
        loan_terms
        );
      loan_terms_month = loan_terms;
    }


    /* display loan terms as year and months start */

    if (loan_terms > 0) { 

      convert_total_terms_to_year_month(loan_terms,repayment_frequency_val);
      convert_total_terms_to_year_month_for_loan_term_frequency_label(loan_terms,repayment_frequency_val);

    }


    /* display loan terms as year and months end */
    

    document.getElementById("ballon_amount_range").max = 80;

    var payment_type = jQuery("#payment_type").val();
    var loan_advance_interest = 0;
    var adloan_amount = 0;
    if (payment_type == "In Advance") {
      if (setting_data.remove_decimal_point == 1) {
        adloan_amount = cal_advance_loan_amount_by_frequency_val(
          repayment_frequency_val,
          loan_amount,
          interest_rates
          );
        var advance_cal = loan_advance_interest_cal(
          repayment_frequency_val,
          adloan_amount,
          interest_rates
          );
        loan_advance_interest = parseInt(advance_cal.loan_advance_interest);
        loan_amount = adloan_amount;
      } else {
        adloan_amount = cal_advance_loan_amount_by_frequency_val(
          repayment_frequency_val,
          loan_amount,
          interest_rates
          );
        var advance_cal = loan_advance_interest_cal(
          repayment_frequency_val,
          loan_amount,
          interest_rates
          );
        loan_advance_interest = advance_cal.loan_advance_interest;
        loan_amount = adloan_amount;
      }
    }

    if (setting_data.remove_decimal_point == 1) {
      var ballon_amounts =
      parseInt(
        (parseInt(loan_amount) + parseInt(loan_advance_interest)) *
        parseInt(ballon_amounts_per)
        ) / 100;
      jQuery("#bill_ballon_per").html(parseInt(ballon_amounts_per));
      jQuery("#bill_ballon_amt").html(addCommas(parseInt(ballon_amounts)));
    } else {
      var ballon_amounts =
      parseFloat(
        (parseFloat(loan_amount) + parseFloat(loan_advance_interest)) *
        parseFloat(ballon_amounts_per)
        ) / 100;
      jQuery("#bill_ballon_per").html(
        parseFloat(ballon_amounts_per).toFixed(2)
        );
      jQuery("#bill_ballon_amt").html(addCommas(ballon_amounts.toFixed()));
    }
    if (setting_data.remove_decimal_point == 1) {
      jQuery("#ballon_amounts").val(addCommas(parseInt(ballon_amounts)));
    } else {
      jQuery("#ballon_amounts").val(
        addCommas(parseFloat(ballon_amounts).toFixed())
        );
    }

    if (parseFloat(ballon_amounts) > parseFloat(loan_amount)) {
      if (setting_data.remove_decimal_point == 1) {
        var new_ballon_amt =
        parseInt(
          (parseInt(loan_amount) + parseInt(loan_advance_interest)) *
          parseInt(ballon_amounts_per)
          ) / 100;
        jQuery("#ballon_amounts").val(addCommas(parseInt(new_ballon_amt)));
        jQuery("#bill_ballon_amt").html(addCommas(parseInt(ballon_amounts)));
      } else {
        var new_ballon_amt =
        parseFloat(
          (parseFloat(loan_amount) + parseFloat(loan_advance_interest)) *
          parseFloat(ballon_amounts_per)
          ) / 100;
        jQuery("#ballon_amounts").val(addCommas(new_ballon_amt.toFixed(2)));
        jQuery("#bill_ballon_amt").html(addCommas(ballon_amounts.toFixed(2)));
      }
    }

    var ballon_amounts = jQuery("#ballon_amounts").val();
    ballon_amounts = ballon_amounts.replaceAll(",", "");
    if (ballon_amounts == "") {
      ballon_amounts = 0;
    }
    if (ballon_amounts > 0) {
      jQuery("#ballon_amt_section").show();
    } else {
      jQuery("#ballon_amt_section").hide();
    }
    if (setting_data.remove_decimal_point == 1) {
      ballon_amounts_per = parseInt(ballon_amounts_per);
      jQuery("#ballon_amounts_per_dis").html(ballon_amounts_per + "%");
      jQuery("#interest_rate_range_dis").html(
        jQuery("#interest_rates").val() + "%"
        );
    } else {
      ballon_amounts_per = parseFloat(ballon_amounts_per);
      jQuery("#ballon_amounts_per_dis").html(
        ballon_amounts_per.toFixed(2) + "%"
        );
      jQuery("#interest_rate_range_dis").html(
        jQuery("#interest_rates").val() + "%"
        );
    }

    var loan_amount_range = document.getElementById("loan_amount_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((loan_amount_range.value - loan_amount_range.min) /
          (loan_amount_range.max - loan_amount_range.min)) *
        100
        );
    } else {
      var value =
      ((loan_amount_range.value - loan_amount_range.min) /
        (loan_amount_range.max - loan_amount_range.min)) *
      100;
    }
    loan_amount_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";

    var interest_rate_range = document.getElementById("interest_rate_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((interest_rate_range.value - interest_rate_range.min) /
          (interest_rate_range.max - interest_rate_range.min)) *
        100
        );
    } else {
      var value =
      ((interest_rate_range.value - interest_rate_range.min) /
        (interest_rate_range.max - interest_rate_range.min)) *
      100;
    }
    interest_rate_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";

    var loan_terms_range = document.getElementById("loan_terms_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((loan_terms_range.value - loan_terms_range.min) /
          (loan_terms_range.max - loan_terms_range.min)) *
        100
        );
    } else {
      var value =
      ((loan_terms_range.value - loan_terms_range.min) /
        (loan_terms_range.max - loan_terms_range.min)) *
      100;
    }
    loan_terms_range.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, " +
    setting_data.back_ground_color +
    " 100%)";

    var ballon_amount_range = document.getElementById("ballon_amount_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((ballon_amount_range.value - ballon_amount_range.min) /
          (ballon_amount_range.max - ballon_amount_range.min)) *
        100
        );
      ballon_amount_range.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)";
      loan_terms = parseInt(loan_terms / 12);
      loan_terms = parseInt(loan_terms);
    } else {
      var value =
      ((ballon_amount_range.value - ballon_amount_range.min) /
        (ballon_amount_range.max - ballon_amount_range.min)) *
      100;
      ballon_amount_range.style.background =
      "linear-gradient(to right, #555555 0%, #555555 " +
      value +
      "%, #fff " +
      value +
      "%, " +
      setting_data.back_ground_color +
      " 100%)";
      loan_terms = parseFloat(loan_terms / 12).toFixed(2);
      loan_terms = parseFloat(loan_terms);
    }

    
    
    if (setting_data.remove_decimal_point == 1) {
      var emi_cal = cal_emi_amount_frequency_payment_options(
        repayment_frequency_val,
        loan_amount,
        interest_rates,
        loan_terms_month,
        ballon_amounts
        );

      monthly_payment = parseInt(emi_cal.emi_amount);

      var total_interests =
      parseInt(monthly_payment) * loan_terms_month - loan_amount;
      var per_month_ballon_amt = 0;
      var ballon_amt_interest = 0;      

      if (ballon_amounts > 0) {     


        ballon_amt_interest = cal_total_interest_on_balloon_amount(repayment_frequency_val,ballon_amounts,interest_rates,loan_terms_month);      
          per_month_ballon_amt = ballon_amt_interest / loan_terms_month;
      }
    } else {
      var emi_cal = cal_emi_amount_frequency_payment_options(
        repayment_frequency_val,
        loan_amount,
        interest_rates,
        loan_terms_month,
        ballon_amounts
        );

      monthly_payment = emi_cal.emi_amount;

      var total_interests = (monthly_payment * loan_terms_month) - loan_amount;     
      var per_month_ballon_amt = 0;
      var ballon_amt_interest = 0;

      if (ballon_amounts > 0) {


        ballon_amt_interest = cal_total_interest_on_balloon_amount(repayment_frequency_val,ballon_amounts,interest_rates,loan_terms_month);
        per_month_ballon_amt = ballon_amt_interest / loan_terms_month;
      }
    }

    var loan_terms = jQuery("#loan_terms").val();

    if (setting_data.remove_decimal_point == 1) { 




      if(repayment_frequency_val=='Fortnight'){


        loan_terms = parseInt(loan_terms / 26);

      }
      else if(repayment_frequency_val=='Weekly'){


        loan_terms = parseInt(loan_terms / 52);

      }
      else{

       loan_terms = parseInt(loan_terms / 12);

     }


     loan_terms = parseInt(loan_terms);


     total_interests =
     parseInt(total_interests) +
     parseInt(ballon_amounts) +
     parseInt(ballon_amt_interest);
     monthly_payment =
     parseInt(monthly_payment) + parseInt(per_month_ballon_amt);   


   } else {      



    if(repayment_frequency_val=='Fortnight'){


      loan_terms = parseFloat(loan_terms / 26).toFixed(2);

    }
    else if(repayment_frequency_val=='Weekly'){


      loan_terms = parseFloat(loan_terms / 52).toFixed(2);          

    }
    else{

      loan_terms = parseFloat(loan_terms / 12).toFixed(2);             

    }

    loan_terms = parseFloat(loan_terms);
    total_interests =
    parseFloat(total_interests) +
    parseFloat(ballon_amounts) +
    parseFloat(ballon_amt_interest);
    monthly_payment = parseFloat(monthly_payment) + parseFloat(per_month_ballon_amt);

  }
  
  /* START: Total Fee Calculation */  

  /* check for the inifinity and NAN value */

  if(monthly_payment==Infinity || monthly_payment =='NaN' || Number.isNaN(monthly_payment) == Number.isNaN(NaN)){
    monthly_payment = 0;
  }



  jQuery("#loan_terms_range").val(jQuery("#loan_terms").val());
  var monthly_fee = setting_data.monthly_rate;
  var application_fee = setting_data.application_fee;
  if (setting_data.calculation_fee_setting_enable == 1) {
    if (setting_data.remove_decimal_point == 1) {


      var loan_terms_for_fee = 0 ;


      if(repayment_frequency_val=='Fortnight'){


        loan_terms_for_fee = parseInt(loan_terms * 26 / 12);

      }
      else if(repayment_frequency_val=='Weekly'){


       loan_terms_for_fee = parseInt(loan_terms * 52 / 26);

     }
     else{


      loan_terms_for_fee = parseInt(loan_terms)

    }


    var total_regular_fee_amt = parseInt(loan_terms_for_fee) * 120;
    total_regular_fee_amt = parseInt(total_regular_fee_amt).toFixed(2);
    jQuery("#total_regular_fee_amt").html(total_regular_fee_amt);

    var total_fee =
    parseInt(application_fee) + parseInt(total_regular_fee_amt);
    jQuery("#total_fee_amt").html(total_fee);



  } else {


    var loan_terms_for_fee = 0 ;


    if(repayment_frequency_val=='Fortnight'){


      loan_terms_for_fee = parseFloat(loan_terms * 26 / 12).toFixed(2);

    }
    else if(repayment_frequency_val=='Weekly'){


      loan_terms_for_fee = parseFloat(loan_terms * 52 / 12).toFixed(2);         

    }
    else{

      loan_terms_for_fee = parseFloat(loan_terms).toFixed(2);


    }




    var total_regular_fee_amt = parseFloat(loan_terms_for_fee) * 120;
    total_regular_fee_amt = parseFloat(total_regular_fee_amt).toFixed(2);   

    jQuery("#total_regular_fee_amt").html(total_regular_fee_amt);

    var total_fee =
    parseFloat(application_fee) + parseFloat(total_regular_fee_amt);
    jQuery("#total_fee_amt").html(total_fee);
  }
}
/* END : Total Fee Calculation*/

/* STRAT : Interests Field Fill*/

if (setting_data.remove_decimal_point == 1) {
  if (setting_data.calculation_fee_setting_enable == 1) {

      /* jQuery("#per_month_amount").html(
        addCommas(
        Math.round(parseInt(monthly_payment + Number(monthly_fee)))
        )
      ); */

    jQuery("#per_month_amount").html(
      addCommas(
        Math.round(parseInt(monthly_payment))
        )
      );


  } else {
    jQuery("#per_month_amount").html(
      addCommas(Math.round(parseInt(monthly_payment)))
      );
  }
} else {
  if (setting_data.calculation_fee_setting_enable == 1) {

      /* jQuery("#per_month_amount").html(
        addCommas(
        parseFloat(monthly_payment + Number(monthly_fee)).toFixed(2)
        )
      ); */

    jQuery("#per_month_amount").html(
      addCommas(
        parseFloat(monthly_payment).toFixed(2)
        )
      );



  } else {      


    jQuery("#per_month_amount").html(
      addCommas(parseFloat(monthly_payment).toFixed(2))
      );
  }
}  


convert_total_terms_to_year_month(loan_terms_month,repayment_frequency_val);
convert_total_terms_to_year_month_for_loan_term_frequency_label(loan_terms_month,repayment_frequency_val);


    //var loan_amount_term_label = 'per ' + repayment_frequency_val.slice(0, -2) + ' for ';
var loan_amount_term_label = "";
if (repayment_frequency_val == "Yearly") {
  loan_amount_term_label = setting_data.repay_freq_per_year_label;
} else if (repayment_frequency_val == "Quarterly") {
  loan_amount_term_label = setting_data.repay_freq_per_quarter_label;
} else if (repayment_frequency_val == "Weekly") {
  loan_amount_term_label = setting_data.repay_freq_per_week_label;
} else if (repayment_frequency_val == "Fortnight") {
  loan_amount_term_label = setting_data.repay_freq_per_fortnight_label;
} else {
  loan_amount_term_label = setting_data.repay_freq_per_month_label;
}

jQuery("#loan_amount_term_label").html(loan_amount_term_label);


if (setting_data.extra_payment_option == '1') {

  jQuery("#extra_payment_loan_amount_term_label").html(loan_amount_term_label.replaceAll('for',''));

}


if (setting_data.remove_decimal_point == 1) {
  jQuery("#loan_amount_rate").html(interest_rates);     

  var total_int_amt = addCommas(
    Math.round(
      parseInt(total_interests) - parseInt(loan_advance_interest)
      )
    );  

      /* check for NAN value */

  if(total_int_amt=='NaN'){
    total_int_amt = 0;
  }


  jQuery("#total_interests_amt").html(addCommas(total_int_amt));
  jQuery("#total_interests_amt_hidden").html(addCommas(total_int_amt));


} else {
  jQuery("#loan_amount_rate").html(interest_rates.toFixed(2));
  if (interest_rates === 0) {       

    jQuery("#total_interests_amt").html(
      addCommas(Math.round(parseFloat(0) - parseFloat(0)))
      );
  } else {

    var total_sum_interests =
    total_interests < loan_advance_interest ? parseFloat(total_interests).toFixed(2):parseFloat(total_interests).toFixed(2);      


      /* check for NAN value */ 
    if(total_sum_interests=='NaN'){
      total_sum_interests = '0.00';
    }

    jQuery("#total_interests_amt").html(addCommas(total_sum_interests));
    jQuery("#total_interests_amt_hidden").html(addCommas(total_sum_interests));

  }
}

var currency_symbols = setting_data.currency_symbols;

/* END : Interests Field Fill*/

/* START : Loan Table Section */
var balance = loan_amount;
var table_data = "";
var rmv_decimal = 0;
var is_advanced = "";
var count = loan_terms_month; 


/* down payment entry in table start */

if (setting_data.down_payment_option == '1') {

  if(parseInt(down_payment) > 0 ){  

    if (setting_data.remove_decimal_point == 1) {

      var table_down_payment = currency_symbols+parseInt(down_payment);
      if(loan_advance_interest > 0){
        var table_loan_amout = parseInt(loan_amount) + parseInt(loan_advance_interest);
      }else{
        var table_loan_amout = parseInt(loan_amount);
      }
      var table_int_rate = currency_symbols+'0';

    }
    else{

      var table_down_payment = currency_symbols+parseFloat(down_payment).toFixed(2);
      if(loan_advance_interest > 0){
        var table_loan_amout = (parseFloat(loan_amount) + parseFloat(loan_advance_interest)).toFixed(2);
      }else{
        var table_loan_amout = parseFloat(loan_amount).toFixed(2);
      }
      var table_int_rate = currency_symbols+'0';

    }

    table_data += '<tr>';
    table_data += '<td>*</td>';
    table_data += '<td>-' +table_down_payment+ '<br/><span style="font-weight: bold;font-size:12px;">('+setting_data.down_payment_label_str+')</span></td>';
    if(setting_data.extra_payment_option == '1'){
      table_data += '<td class="extra-payment-column">'+currency_symbols+'0.00'+'</td>';
    }
    table_data += '<td>'+table_int_rate+'</td>';
    table_data += '<td>'+currency_symbols+''+table_loan_amout + '</td>';
    table_data += '</tr>';

  }

}

/* down payment entry in table end  */

if (setting_data.extra_payment_option == '1') { 
  var old_balance_for_extra_pay = 0; 
  var total_interest_for_extra_pay = 0;     
  var total_extra_payment = 0;
}   

if (payment_type == "In Advance") {

     table_data += '<tr>';
        table_data += '<td>*</td>';
        table_data += '<td>'+currency_symbols+'0.00'+'</td>';
        if(setting_data.extra_payment_option == '1'){
          table_data += '<td class="extra-payment-column">'+currency_symbols+'0.00'+'</td>';
        }
        table_data += '<td>'+currency_symbols+''+(setting_data.remove_decimal_point == 1 ? parseInt(loan_advance_interest): parseFloat(loan_advance_interest).toFixed(2))+'<span style="font-weight: bold;font-size:12px;"> (Advanced)</span></td>';
        table_data += '<td>'+currency_symbols+ '' +(setting_data.remove_decimal_point == 1 ? parseInt(loan_amount) : parseFloat(loan_amount) )+ '</td>';
        table_data += '</tr>';
}


for (var i = 1; i <= loan_terms_month; i++) {
  if (setting_data.remove_decimal_point == 1) {
    rmv_decimal = 1;
  } else {
    rmv_decimal = 0;
  }
  
  count = loan_terms_month - i; 
  var interest = cal_interest_amount_by_fre_payment_option(
    repayment_frequency_val,
    count,
    parseFloat(balance).toFixed(2),
    interest_rates,
    rmv_decimal
    );
  
  if (setting_data.remove_decimal_point == 1) {
    var principal = parseInt(monthly_payment) - parseInt(interest);
  } else {
    var principal =
    parseFloat(monthly_payment) - parseFloat(interest).toFixed(2);
  }
  
  if (setting_data.extra_payment_option == '1') { 
   old_balance_for_extra_pay = balance; 
 }     

 balance = balance - principal;


      /* deduct extra payment from  balance in table entry */

 if (setting_data.extra_payment_option == '1') {        

  balance = balance - extra_payment; 
}  

      /* deduct extra payment from  balance in table entry */


table_data += "<tr class='emi-row'>";
table_data += "<td>" + i + "</td>";

if (setting_data.remove_decimal_point == 1) {
  var display_monthly_payment = Math.ceil(monthly_payment);
} else {
  var display_monthly_payment = monthly_payment;
}
if (i == loan_terms_month) {
  if (setting_data.remove_decimal_point == 1) {
    display_monthly_payment =
    parseInt(display_monthly_payment) + parseInt(ballon_amounts);
  } else {
    display_monthly_payment =
    parseFloat(display_monthly_payment) + parseFloat(ballon_amounts);
  }
}

if (interest < 0) {
  interest = 0;
}


      /* EMI column of table code */

if(setting_data.extra_payment_option == '1' && extra_payment > 0 && parseInt(balance)<0){

  var Updated_EMI;
  

  if(old_balance_for_extra_pay < display_monthly_payment){              

    if(ballon_amounts > 0){

      if(ballon_amounts > old_balance_for_extra_pay){

        Updated_EMI = Number(old_balance_for_extra_pay)+Number(interest);

      }
      else{

        Updated_EMI = Number(old_balance_for_extra_pay)+Number(interest)+parseFloat(ballon_amounts);

        if(Updated_EMI > old_balance_for_extra_pay){
          Updated_EMI = Number(old_balance_for_extra_pay)+Number(interest);
        }


      }


    }
    else{
      Updated_EMI =   Number(old_balance_for_extra_pay) + Number(interest);
    }

    if (setting_data.remove_decimal_point == 1) {
      table_data +=
      "<td>-" +
      currency_symbols +
      parseInt(Updated_EMI) +
      "</td>";
    } else {
      table_data +=
      "<td>-" +
      currency_symbols +
      parseFloat(Updated_EMI).toFixed(2) +
      "</td>";
    }

  }
  else{

    if(ballon_amounts > 0){

      if(ballon_amounts > old_balance_for_extra_pay){

        Updated_EMI  = parseFloat(old_balance_for_extra_pay) + interest;

      }
      else{

        Updated_EMI  = display_monthly_payment + parseFloat(ballon_amounts);

        if(Updated_EMI > old_balance_for_extra_pay){

          Updated_EMI = old_balance_for_extra_pay + interest;

        }

      }                 

    }
    else{

      Updated_EMI  = display_monthly_payment;

    } 


    if (setting_data.remove_decimal_point == 1) {
      table_data +=
      "<td>-" +
      currency_symbols +
      parseInt(Updated_EMI) +
      "</td>";
    } else {
      table_data +=
      "<td>-" +
      currency_symbols +
      parseFloat(Updated_EMI).toFixed(2) +
      "</td>";
    }

  }           


}else{

  if (setting_data.remove_decimal_point == 1) {
    table_data +=
    "<td>-" +
    currency_symbols +
    parseInt(display_monthly_payment) +
    "</td>";
  } else {
    table_data +=
    "<td>-" +
    currency_symbols +
    parseFloat(display_monthly_payment).toFixed(2) +
    "</td>";
  }

}

      /* EMI column of table code */


      /* extra payment column data for table entry */

if (setting_data.extra_payment_option == '1' && extra_payment > 0) {  


  if(parseInt(balance)<0){

    if(old_balance_for_extra_pay < display_monthly_payment){

      table_data +=
      "<td class='extra-payment-column'>-" +
      currency_symbols +
      "0" +
      "</td>";


    }
    else{

      var Updated_EMI = display_monthly_payment + parseInt(ballon_amounts);

      if(parseInt(ballon_amounts) > 0 && Updated_EMI > old_balance_for_extra_pay){

        table_data +=
        "<td class='extra-payment-column'>-" +
        currency_symbols +
        "0" +
        "</td>";

      }
      else{

        if(parseInt(ballon_amounts) > 0){

          var ext_pay = old_balance_for_extra_pay - (display_monthly_payment + parseInt(ballon_amounts) );  

          if(ext_pay<0){
            ext_pay = 0;
          }

        }
        else{

          var ext_pay = old_balance_for_extra_pay - display_monthly_payment;

          if(ext_pay<0){
            ext_pay = 0;
          }

        }



        if(ext_pay < extra_payment){

          table_data +=
          "<td class='extra-payment-column'>-" +
          currency_symbols +
          parseInt(ext_pay+interest) +
          "</td>";  

          total_extra_payment = parseInt(total_extra_payment) + parseInt(ext_pay+interest);

        }         
        else{ 

          table_data +=
          "<td class='extra-payment-column'>-" +
          currency_symbols +
          parseInt(extra_payment) +
          "</td>";

          total_extra_payment = parseInt(total_extra_payment) + parseInt(extra_payment);

        }

      }


    }


  }
  else{


    table_data +=
    "<td class='extra-payment-column'>-" +
    currency_symbols +
    parseInt(extra_payment) +
    "</td>";

    total_extra_payment = parseInt(total_extra_payment) + parseInt(extra_payment);

  } 


}

      /* extra payment column data for table entry */      
if (setting_data.remove_decimal_point == 1) {
  table_data +=
  "<td>" +
  currency_symbols +
  parseInt(interest) +
  "</td>";
} else {
  table_data +=
  "<td>" +
  currency_symbols +
  parseFloat(interest).toFixed(2) +
  "</td>";
}

if (i == loan_terms_month) {
  balance = 0;
}
var display_balance = balance;
if (
  display_balance < 0 ||
  (display_balance > 0 && display_balance < 1)
  ) {
  display_balance = 0.0;
}
if (setting_data.remove_decimal_point == 1) {
  display_balance = parseInt(display_balance);
} else {
  display_balance = parseFloat(display_balance).toFixed(2);
}


if (parseInt(balance) < 0) {
  table_data += "<td>$0.00</td>";
} else {
  table_data += "<td>" + currency_symbols + display_balance + "</td>";
}

table_data += "</tr>";

if(setting_data.extra_payment_option == '1'){

   if (setting_data.remove_decimal_point == 1) {

     if (payment_type == "In Advance" && i==1) { 

         total_interest_for_extra_pay = parseInt(total_interest_for_extra_pay) + parseInt(interest);

     }
     else{
         total_interest_for_extra_pay = parseInt(total_interest_for_extra_pay) + parseInt(interest);
     }
   
  }
  else{

    if (payment_type == "In Advance" && i==1) { 
      total_interest_for_extra_pay = parseFloat(total_interest_for_extra_pay) + parseFloat(interest);

    }
    else{

        total_interest_for_extra_pay = parseFloat(total_interest_for_extra_pay) + parseFloat(interest); 
    }
              
  }


  if (parseInt(balance) < 0) {
   break;
  } 

}  

 /* extra payment calculate total interest and break loop of table entry wnen balance get 0 */


}




jQuery("#loan_table_data").html(table_data);


/* hide extra payment table column when its 0 */

if (setting_data.extra_payment_option == '1') {   

  if(parseInt(extra_payment)==0){
    jQuery('.extra-payment-column').hide(); 
  }
  else{
    jQuery('.extra-payment-column').show(); 
  }

}

/* hide extra payment table column when its 0 */

/* extra payment display total interest in summary result */

if (setting_data.extra_payment_option == '1' && extra_payment > 0) {

  if (setting_data.remove_decimal_point == 1) {

    jQuery("#total_interests_amt").html(addCommas(total_interest_for_extra_pay));
    jQuery("#total_interests_amt_hidden").html(addCommas(total_interest_for_extra_pay));

  }
  else{

    jQuery("#total_interests_amt").html(addCommas(total_interest_for_extra_pay.toFixed(2)));
    jQuery("#total_interests_amt_hidden").html(addCommas(total_interest_for_extra_pay.toFixed(2)));

  }


        /* change total interest variable for chart */

  total_interests = total_interest_for_extra_pay; 


  if (setting_data.hide_total_extra_payments != '1'){

    jQuery("#bottom_total_extra_payment").text(addCommas(total_extra_payment));

  }


  /* saved interest after extra payment start */

  var total_interest_without_extra_payment = get_total_interest_without_extra_payment();
  
  total_interest_without_extra_payment = total_interest_without_extra_payment.replaceAll(",", "");
  
  
  var saved_inter_after_extra_payment = 0;  


  if(parseInt(total_interest_without_extra_payment) > 0){  

    if (setting_data.remove_decimal_point == 1) {

        saved_inter_after_extra_payment = parseInt(total_interest_without_extra_payment) - parseInt(total_interest_for_extra_pay);

    }
    else{

       saved_inter_after_extra_payment = parseFloat(total_interest_without_extra_payment) - parseFloat(total_interest_for_extra_pay);

       saved_inter_after_extra_payment = saved_inter_after_extra_payment.toFixed(2);
    }


    if(saved_inter_after_extra_payment < 0){
      saved_inter_after_extra_payment = 0;
    }


  }

   jQuery('#interest_save_for_extra_payment').html(addCommas(saved_inter_after_extra_payment));


  /* saved interest after extra payment end */


}

/* extra payment display total interest in summary result */


/* END : Loan Table Section */

/* START : Loan Chart Section */
var balance_arr = [];
var remainig_interests = [];
var total_monthly_payment = [];
var total_principal_amonut = [];
var balance = loan_amount;
var interestSum = 0;
var principalSum = 0;
var monthly_paymentSum = 0;

var graph_type = "Years";
if (loan_terms_month <= 12) {
  graph_type = "Months";
}
graph_type = "Months";

for (var p = 1; p <= loan_terms_month; p++) {
  if (p == 1) {
    if (setting_data.remove_decimal_point == 1) {
      remainig_interests.push(parseInt(total_interests));
      balance_arr.push(parseInt(balance));
    } else {
      remainig_interests.push(parseFloat(total_interests.toFixed(2)));
      balance_arr.push(parseFloat(balance.toFixed(2)));
    }
  }
  
  if (setting_data.remove_decimal_point == 1) {
    rmv_decimal = 1;
  } else {
    rmv_decimal = 0;
  }
      //var interest = balance * interest_rates / 1200;
  count = loan_terms_month - p;
  var interest = cal_interest_amount_by_fre_payment_option(
    repayment_frequency_val,
    count,
    balance,
    interest_rates,
    rmv_decimal
    );
  
  var principal = monthly_payment - parseFloat(interest).toFixed(2);
  
  if (p == loan_terms_month) {
    balance = balance - principal - ballon_amounts;
  } else {
    balance = balance - principal;
  }


       /* deduct extra payment from  balance in table entry */

  if (setting_data.extra_payment_option == '1') {        

    balance = balance - extra_payment; 
  }  

      /* deduct extra payment from  balance in table entry */


  
  var total_interests = total_interests - interest;
  if (balance < 0 || (balance > 0 && balance < 1)) {
    balance = 0;
  }
  if (
    total_interests < 0 ||
    (total_interests > 0 && total_interests < 1)
    ) {
    total_interests = 0;
}

 interestSum += interest;  // Accumulate interest
 principalSum += principal; 
 monthly_paymentSum += monthly_payment;

if (loan_terms_month > 120) {
  if (p % 12 == 0 || p == loan_terms_month) {
    if (setting_data.remove_decimal_point == 1) {
      /*remainig_interests.push(parseInt(interest));
      balance_arr.push(parseInt(balance));*/
      remainig_interests.push(parseInt(interestSum)); 
      balance_arr.push(parseInt(balance));
      total_monthly_payment.push(parseInt(monthly_paymentSum));
      total_principal_amonut.push(parseInt(monthly_paymentSum) - parseInt(interestSum));
    } else {
      remainig_interests.push(parseFloat(interestSum.toFixed(2)));
      balance_arr.push(parseFloat(balance.toFixed(2)));
      total_monthly_payment.push(parseFloat(monthly_paymentSum.toFixed(2)));
      total_principal_amonut.push(parseFloat(monthly_paymentSum.toFixed(2)) - parseFloat(interestSum.toFixed(2)));
    }
    interestSum = 0;
    //principalSum = 0;
    monthly_paymentSum = 0;
  }
} else {
  if (setting_data.remove_decimal_point == 1) {
    remainig_interests.push(parseInt(interest));
    if(setting_data.chart_types == 'stacked_bar'){
      balance_arr.push(parseInt(balance));
      total_monthly_payment.push(parseInt(monthly_paymentSum));
      total_principal_amonut.push(parseInt(monthly_paymentSum) - parseInt(interestSum));
    }else{
      balance_arr.push(parseInt(principal));
    }
  } else {
    remainig_interests.push(parseFloat(interest).toFixed(2));
    if(setting_data.chart_types == 'stacked_bar'){
      balance_arr.push(parseFloat(balance.toFixed(2)));
      total_monthly_payment.push(parseFloat(monthly_payment.toFixed(2)));
      total_principal_amonut.push(parseFloat(monthly_payment.toFixed(2)) - parseFloat(interest.toFixed(2)));
    }else{
      balance_arr.push(parseFloat(principal.toFixed(2)));
    }

  }
}
      // total_interests


        /* extra payment chart no of payments */

if (setting_data.extra_payment_option == '1' && parseInt(balance) <= 0 && extra_payment > 0) {         
 break; 
}
      /* extra payment chart no of payments */   

}


/* START : PREPARE CHART JS DATA */
var loan_data = [];
const interests = [];
const total_balance_arr = [];
const xData = [];

/* new stacked bar chart */
const principal_calc_new_arr = [];
const extra_payment_arr = [];


for (var p = 1; p < remainig_interests.length; p++) {
  total_balance_arr.push(balance_arr[p]);
  if (setting_data.remove_decimal_point == 1) {
    interests.push(parseInt(remainig_interests[p]));
    /* new stacked bar chart */
    if(setting_data.chart_types == 'stacked_bar'){
      principal_calc_new_arr.push(parseInt(monthly_payment) - parseInt(remainig_interests[p]));
    }

  } else {

    interests.push(parseFloat(remainig_interests[p]));
    /* new stacked bar chart */
    if(setting_data.chart_types == 'stacked_bar'){
      principal_calc_new_arr.push(parseFloat(monthly_payment) - parseFloat(remainig_interests[p]));
    }

  }
  xData.push(p);

  /* new stacked bar chart */
  if(setting_data.chart_types == 'stacked_bar'){
    extra_payment_arr.push(extra_payment);
  }
}

var graphColor = $("#loan-process-graph").css("--calc-graph-color");
var graph_color_sub = $("#loan-process-graph").css(
  "--calc-graph-color-sub"
  );
var graph_border_color = $("#loan-process-graph").css(
  "--calc-graph-border-color"
  );
var graph_border_color_sub = $("#loan-process-graph").css(
  "--calc-graph-border-color-sub"
  );

/* new stacked bar chart */
if(setting_data.chart_types == 'stacked_bar'){
  var balance_border_color_graph = $("#loan-process-graph").css(
    "--calc-graph-balance-border-color"
    );
  var balance_point_background_color_graph = $("#loan-process-graph").css(
    "--calc-graph-balance-point-background-color"
    );
  var extra_payment_graph_color = $("#loan-process-graph").css(
    "--calc-graph-extra-payment-graph-color"
    );
}

const colors = {
  green: {
    fill: "#e0eadf",
    stroke: "#5eb84d",
  },
  
  lightBlue: {
    stroke: "#6fccdd",
  },
  
  darkBlue: {
    fill: graphColor,
    stroke: graph_border_color,
  },
  
  purple: {
    fill: graph_color_sub,
    stroke: graph_border_color_sub,
  },
};


var data = {};

/* new stacked bar chart */
if(setting_data.chart_types == 'stacked_bar'){  

  if (typeof balance_point_background_color_graph === 'undefined'){
      balance_point_background_color_graph = setting_data.balance_point_background_color_graph;
  }

  if (typeof balance_border_color_graph === 'undefined'){
      balance_border_color_graph = setting_data.balance_border_color_graph;
  }

  if (typeof extra_payment_graph_color === 'undefined'){
      extra_payment_graph_color = setting_data.extra_payment_graph_color;
  }


  var data_sets_graph = [

       {
          // label: "Balance",
          label: 'Balance',
          type:'line',
          fill: false,
          data: total_balance_arr,
          backgroundColor: balance_point_background_color_graph,
          pointBackgroundColor: balance_point_background_color_graph,
          borderColor: balance_border_color_graph,
          pointHighlightStroke: balance_point_background_color_graph,
          borderCapStyle: "butt",  
          pointRadius: 5
          
      },    
      {
            // label: "Principal",
        label: setting_data.principal_label,
        fill: true,
        backgroundColor: colors.darkBlue.fill,
        pointBackgroundColor: colors.darkBlue.stroke,
        borderColor: colors.darkBlue.stroke,
        pointHighlightStroke: colors.darkBlue.stroke,
        borderCapStyle: "butt",
        data: total_principal_amonut,
        yAxisID: 'y1'
        
      },  
      {
        //  label: "Interest",
        label: setting_data.interest_label,
        fill: true,
        backgroundColor: colors.purple.fill,
        pointBackgroundColor: colors.purple.stroke,
        borderColor: colors.purple.stroke,
        pointHighlightStroke: colors.purple.stroke,
        borderCapStyle: "butt",
        data: interests,
        yAxisID: 'y1'    
      } 
       
    ];


    if(extra_payment > 0){

          data_sets_graph.push({
            //  label: "Extra payment",
            label: "Extra Payment",
            fill: true,
            backgroundColor: extra_payment_graph_color,
            pointBackgroundColor: colors.purple.stroke,
            borderColor: colors.purple.stroke,
            pointHighlightStroke: colors.purple.stroke,
            borderCapStyle: "butt",
            data: extra_payment_arr,
            yAxisID: 'y1'    
        });
    }



  data = {
  labels: xData,
  datasets: data_sets_graph  
  };

}else{

    data = {
    labels: xData,
    datasets: [
    {
          //  label: "Interest",
      label: setting_data.interest_label,
      fill: true,
      backgroundColor: colors.purple.fill,
      pointBackgroundColor: colors.purple.stroke,
      borderColor: colors.purple.stroke,
      pointHighlightStroke: colors.purple.stroke,
      borderCapStyle: "butt",
      data: interests,
    },
    
    {
          // label: "Principal",
      label: setting_data.principal_label,
      fill: true,
      backgroundColor: colors.darkBlue.fill,
      pointBackgroundColor: colors.darkBlue.stroke,
      borderColor: colors.darkBlue.stroke,
      pointHighlightStroke: colors.darkBlue.stroke,
      borderCapStyle: "butt",
      data: total_balance_arr,
    },
    ],
  };


}

Chart.Tooltip.positioners.custom = function (elements, position) {
      //debugger;
  return {
    x: position.x,
    y: position.y,
  };
};

    // setTimeout(() => {
var ctx = $("#loan-process-graph").get(0).getContext("2d");

var default_theme_chart = Chart.getChart("loan-process-graph");


if (default_theme_chart) {
  default_theme_chart.destroy();
}

/* new stacked bar chart */
if(setting_data.chart_types == 'stacked_bar'){ 

  default_theme_chart = new Chart(ctx, {
      type: 'bar', 
      data: data,
      responsive: true,
      options: {  
        title: {
          display: true,
          text: "Loan Calculator",
        },
        layout: {
          padding: 32,
        },
        tooltips: {
          mode: "index",
          intersect: true,
          position: "custom",
          yAlign: "bottom",
        },      
        scales: {
          xAxes: {
            stacked: true, 
            gridLines: {
              display: false,
            },              
            scaleLabel: {
              display: true,
              labelString: "Term (Months)",
            },
            min: 1,
            title: {
                    display: true,
                    text: 'No. of Payments'
            },
          },          
          yAxes: {
            stacked: true, 
            beginAtZero: false, 
            gridLines: {
              display: true,
            },             
            scaleLabel: { 
              display: true,
              labelString: "Amount Owing ($)",
            }, 
            title: {
                display: true,
                text: 'Balance'
            }           
          },
          y1: { 
                type: 'linear',
                position: 'right',
                min: 0,                 
                title: {
                    display: true,
                    text: 'EMI Payment / '+repayment_frequency_val
                },
                stacked: true, 
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          datalabels : {
                display:false,
          },
          htmlLegend: {            
            containerID: 'lc-chart-legend-container',
          },          
          tooltip: {
              enabled: false, // Disable default tooltips
              external: function(context) {
                    // Tooltip Element
                    let tooltipEl = document.getElementById('chartjs-tooltip');                    
                    if (!tooltipEl) {
                        tooltipEl = document.createElement('div');
                        tooltipEl.id = 'chartjs-tooltip';
                        tooltipEl.innerHTML = '<table></table>';
                        document.body.appendChild(tooltipEl);
                    }                    
                    const tooltipModel = context.tooltip;
                    if (tooltipModel.opacity === 0) {
                        tooltipEl.style.opacity = 0;
                        return;
                    }                    
                    tooltipEl.classList.remove('above', 'below', 'no-transform');
                    if (tooltipModel.yAlign) {
                        tooltipEl.classList.add(tooltipModel.yAlign);
                    } else {
                        tooltipEl.classList.add('no-transform');
                    }
                    function getBody(bodyItem) {
                        return bodyItem.lines;
                    }                    
                    if (tooltipModel.body) {
                        const titleLines = tooltipModel.title || [];
                        const bodyLines = tooltipModel.body.map(getBody);

                        let innerHtml = '<div style="background-color:#fff;padding:10px;border:1px solid #ccc;">';

                        titleLines.forEach(function(title) {
                            innerHtml += '<p style="margin:0px;">No. Payment: ' + title + '</p>';
                        });
                        bodyLines.forEach(function(body, i) {     
                            innerHtml += '<p style="margin:0px;">' + body + '</p>';
                            if(body[0].split(':')[0]!='Balance'){

                              if(parseInt(extra_payment) > 0){                               

                                var total_payment_graph = monthly_payment+parseInt(extra_payment)

                                if(setting_data.remove_decimal_point=='1'){
                                  total_payment_graph = parseInt(total_payment_graph);
                                }
                                else{
                                  total_payment_graph = parseFloat(total_payment_graph).toFixed(2);  
                                }

                                innerHtml += '<p style="margin:0px;">Total Payment: '+total_payment_graph+'</p>';
                              }
                              else{                               
                                var totalpayment= (total_monthly_payment[i] != ''?total_monthly_payment[i]:monthly_payment);
                                innerHtml += '<p style="margin:0px;">Total Payment: '+totalpayment+'</p>';
                              }

                            }

                        });
                        innerHtml += '</div>';

                        let tableRoot = tooltipEl.querySelector('table');
                        tableRoot.innerHTML = innerHtml;
                    }

                    const position = context.chart.canvas.getBoundingClientRect();
                    const bodyFont = Chart.helpers.toFont(tooltipModel.options.bodyFont);
                    tooltipEl.style.opacity = 1;
                    tooltipEl.style.position = 'absolute';
                    tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
                    tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
                    tooltipEl.style.font = bodyFont.string;
                    tooltipEl.style.padding = tooltipModel.padding + 'px ' + tooltipModel.padding + 'px';
                    tooltipEl.style.pointerEvents = 'none';
                }
          },
        },
        onHover: function(event, chartElement) {
            const datasetIndex = chartElement[0]?.datasetIndex;            
            // Reset all dataset colors
            this.data.datasets.forEach((dataset, index) => {
                dataset.backgroundColor = index === datasetIndex
                    ? dataset.backgroundColor.replace(/0\.2/, '0.9') // Highlight
                    : dataset.backgroundColor.replace(/0\.9/, '0.2'); // Reset
            });

            // Re-render the chart
            this.update();
        }
      },
      plugins: [htmlLegendPlugin],
    });

}
else{ 
var intersectValue = setting_data.chart_types == "bar" ? { intersect: false, mode: 'index' } : { intersect: true, mode: 'nearest' }; // default values

    default_theme_chart = new Chart(ctx, {
      type: setting_data.chart_types,
      data: data,
      responsive: true,
      options: {
        title: {
          display: true,
          text: "Loan Calculator",
        },
        interaction: intersectValue,
        layout: {
          padding: 32,
        },
        tooltips: {
          mode: "index",
          intersect: true,
          position: "custom",
          yAlign: "bottom",
        },
        scales: {
          xAxes: [
          {
            stacked: true,
            gridLines: {
              display: false,
            },
              // display:false,
            scaleLabel: {
              display: true,
              labelString: "Term (Months)",
            },
          },
          ],
          yAxes: [
          {
            stacked: true,
            gridLines: {
              display: false,
            },
              // display:false,

            scaleLabel: {
              display: true,
              labelString: "Amount Owing ($)",
            },
          },
          ],
        },
        plugins:{
           datalabels : {
                display:false,
              },
        }
      },
     });

 }


  /* extrapayment code to deduct time frequency in summary result */
  if (setting_data.extra_payment_option == '1' && extra_payment > 0) {
      convert_total_terms_to_year_month(loan_terms_month,repayment_frequency_val);
  }


   /* Summary Chart Break-up of Total Payment */

   if(setting_data.summary_chart_option == '1'){
    
      var break_up_chart_data = {};      
      break_up_chart_data['total_principal'] = parseFloat(principalSum).toFixed(2);
      break_up_chart_data['total_interest'] = jQuery("#total_interests_amt_hidden").text();
      break_up_chart_data['down_payment'] = jQuery("#down_payment").val();
      break_up_chart_data['total_extra_payment'] = jQuery("#bottom_total_extra_payment").text();
      break_up_chart_data['ballon_amount'] = jQuery("#ballon_amounts").val(); 
      break_up_of_total_payment_chart(break_up_chart_data);

    }
    
    /* Summary Chart Break-up of Total Payment */

    // }, 50);
/* END : PREPARE CHART JS DATA */
} /* END : Loan Calculation Process */

    /* START : Textbox Blur Event*/
jQuery("#loan_amount").blur(function () {
  var loan_amount = jQuery("#loan_amount").val();
  
  jQuery("#loan_amount").val(addCommas(jQuery("#loan_amount").val()));
  loan_amount = loan_amount.replaceAll(",", "");
  if (loan_amount == "" || loan_amount == ".") {
    jQuery("#loan_amount").val(
      addCommas(setting_data.loan_amount_min_value)
      );
  }
  if (parseFloat(loan_amount) < setting_data.loan_amount_min_value) {
    jQuery("#loan_amount").val(
      addCommas(setting_data.loan_amount_min_value)
      );
  }
  if (parseFloat(loan_amount) >= setting_data.loan_amount_max_value) {
    jQuery("#loan_amount").val(
      addCommas(setting_data.loan_amount_max_value)
      );
  }
  if (setting_data.disable_ballon_amt !== "1") {
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    if (
      parseFloat(ballon_amount_range.value) == 0 ||
      parseInt(ballon_amount_range.value) == 0
      ) {
      document.getElementById("ballon_amounts").value = 0 + "%";
    document.getElementById("ballon_amounts_per").value = 0 + "%";
    document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
  }
}
var loan_amount = jQuery("#loan_amount").val();
loan_amount = loan_amount.replaceAll(",", "");

if (setting_data.down_payment_option == '1') {

  jQuery("#loan_amount").val(addCommas(parseInt(loan_amount)));

}

jQuery("#loan_amount_range").val(parseFloat(loan_amount));
loan_calculation_process();
});

jQuery("#loan_terms").on("blur", function () {  
    /*on filled input check min max values */
  var repayment_freq = jQuery("#repayment_freq option:selected").val();
  var old_repayment_freq = jQuery(
    "input[name='current_repayment_freq']"
    ).val();
  var default_nop_value = jQuery("input[name='loan_terms']").val();
  
  /* visible note below chart */
  if(default_nop_value > 120){
    jQuery('body').find('.chart-note').show();
  }else{
    jQuery('body').find('.chart-note').hide();
  }
    /* nop = number of payments */
  var min_nop_value = jQuery("input[name='min_value']").val();
  var max_nop_value = jQuery("input[name='max_value']").val();
  
  var numbers_of_payments = cal_numbers_of_payment_by_frequency_val(
    repayment_freq,
    old_repayment_freq,
    default_nop_value,
    min_nop_value,
    max_nop_value
    );
  
  var loan_terms = jQuery("#loan_terms").val();
  jQuery("input[name='current_repayment_freq']").val(repayment_freq);
  
  if (loan_terms == "" || loan_terms == ".") {
    jQuery("#loan_terms").val(numbers_of_payments.nop_min_value);
  }
  
  if (parseFloat(loan_terms) < numbers_of_payments.nop_min_value) {
    jQuery("#loan_terms").val(numbers_of_payments.nop_min_value);
  }
  if (parseFloat(loan_terms) > numbers_of_payments.nop_max_value) {
    jQuery("#loan_terms").val(numbers_of_payments.nop_max_value);
  }
  if (setting_data.disable_ballon_amt !== "1") {
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    if (
      parseFloat(ballon_amount_range.value) == 0 ||
      parseInt(ballon_amount_range.value) == 0
      ) {
      document.getElementById("ballon_amounts").value = 0 + "%";
    document.getElementById("ballon_amounts_per").value = 0 + "%";
    document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
  }
}

jQuery("#loan_terms_range").val(jQuery("#loan_terms").val());
var monthly_fee = jQuery("#monthly_fee").val();
var application_fee = jQuery("#application_fee").val();
var loan_terms = jQuery("#loan_terms").val();
var total_regular_fee_amt = parseFloat(loan_terms) * 120;
jQuery("#total_regular_fee_amt").html(total_regular_fee_amt);
if (setting_data.remove_decimal_point == 1) {
  var total_fee =
  parseInt(application_fee) + parseInt(total_regular_fee_amt);
} else {
  var total_fee =
  parseFloat(application_fee) + parseFloat(total_regular_fee_amt);
}

jQuery("#total_fee_amt").html(total_fee);
loan_calculation_process();
});

jQuery("#interest_rates").blur(function () {
  var interest_rates = jQuery("#interest_rates").val();
  if (setting_data.remove_decimal_point == 1) {
    if (interest_rates == "" || interest_rates == ".") {
      jQuery("#interest_rates").val(
        parseInt(setting_data.interest_rate_min_value)
        );
    }
    if (parseFloat(interest_rates) < setting_data.interest_rate_min_value) {
      jQuery("#interest_rates").val(
        parseInt(setting_data.interest_rate_min_value)
        );
    }
    if (parseFloat(interest_rates) > setting_data.interest_rate_max_value) {
      jQuery("#interest_rates").val(
        parseInt(setting_data.interest_rate_max_value)
        );
    }
  } else {
    if (interest_rates == "" || interest_rates == ".") {
      jQuery("#interest_rates").val(
        parseFloat(setting_data.interest_rate_min_value).toFixed(2)
        );
    }
    if (parseFloat(interest_rates) < setting_data.interest_rate_min_value) {
      jQuery("#interest_rates").val(
        parseFloat(setting_data.interest_rate_min_value).toFixed(2)
        );
    }
    if (parseFloat(interest_rates) > setting_data.interest_rate_max_value) {
      jQuery("#interest_rates").val(
        parseFloat(setting_data.interest_rate_max_value).toFixed(2)
        );
    }
  }
  if (setting_data.disable_ballon_amt !== "1") {
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    if (
      parseFloat(ballon_amount_range.value) == 0 ||
      parseInt(ballon_amount_range.value) == 0
      ) {
      document.getElementById("ballon_amounts").value = 0 + "%";
    document.getElementById("ballon_amounts_per").value = 0 + "%";
    document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
  }
}

var interest_rates = jQuery("#interest_rates").val();

if (setting_data.remove_decimal_point == 1) {
  jQuery("#interest_rates").val(parseInt(interest_rates));
} else {
  jQuery("#interest_rates").val(parseFloat(interest_rates).toFixed(2));
}

jQuery("#interest_rate_range").val(jQuery("#interest_rates").val());
jQuery("#interest_rate_range_dis").html(
  jQuery("#interest_rates").val() + "%"
  );

loan_calculation_process();
});

jQuery("#ballon_amounts_per").blur(function () {
  if (jQuery("#extra_payment").length) {
    jQuery("#extra_payment").val(0);   
    jQuery("#extra_payment_range").val(0);   
  }
  var currency_symbol = setting_data.currency_symbols;
  jQuery("#ballon_amount_range").val(
    jQuery("#ballon_amounts_per").val().replaceAll("%", "")
    );
  var loan_amount = jQuery("#loan_amount")
  .val()
  .replaceAll(currency_symbol, "");
  loan_amount = loan_amount.replaceAll(",", "");
  var ballon_amounts_per = jQuery("#ballon_amounts_per")
  .val()
  .replaceAll("%", "");


  if(parseInt(ballon_amounts_per) > 80){
      jQuery("#ballon_amounts_per").val(80);
      ballon_amounts_per = 80;
  }

  
  if (setting_data.remove_decimal_point == 1) {
    var ballon_amounts =
    parseInt(parseInt(loan_amount) * parseInt(ballon_amounts_per)) / 100;
  } else {
    var ballon_amounts =
    parseFloat(parseFloat(loan_amount) * parseFloat(ballon_amounts_per)) /
    100;
  }
  
  if (ballon_amounts_per == "" || ballon_amounts_per == ".") {
    jQuery("#ballon_amounts_per").val(
      setting_data.default_balloon_amount + "%"
      );
    jQuery("#ballon_amount_range").val(setting_data.default_balloon_amount);
    ballon_amounts_per = setting_data.default_balloon_amount;
  }
  
  jQuery("#ballon_amounts").val(ballon_amounts);
  jQuery("#bill_ballon_amt").html(ballon_amounts);
  jQuery("#interest_rate_range_dis").html(
    jQuery("#interest_rates").val() + "%"
    );
  jQuery("#ballon_amounts_per_dis").html(ballon_amounts_per + "%");
  loan_calculation_process();

});

jQuery("#ballon_amounts").blur(function () {
  var ballon_amount_range = document.getElementById("ballon_amount_range");
  if (
    parseFloat(ballon_amount_range.value) == 0 ||
    parseInt(ballon_amount_range.value) == 0
    ) {
    document.getElementById("ballon_amounts").value = 0 + "%";
  document.getElementById("ballon_amounts_per").value = 0 + "%";
  document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
}
var ballon_amounts = $(this).val();
var ballon_amounts_per = jQuery("#ballon_amounts_per").val();
ballon_amount_range.value = ballon_amounts_per;
var loan_amount = jQuery("#loan_amount").val();
loan_amount = loan_amount.replaceAll(",", "");

if (ballon_amounts == "" || ballon_amounts == ".") {
  jQuery("#ballon_amounts").val(0);
}

ballon_amounts = ballon_amounts.replaceAll(",", "");

if (ballon_amounts == "" || ballon_amounts == ".") {
  ballon_amounts = 0;
  ballon_amounts_per = 0;
} else {
  if (setting_data.remove_decimal_point == 1) {
    var ballon_amounts_per = parseInt(
      (parseInt(ballon_amounts) * 100) / parseInt(loan_amount)
      );
  } else {
    var ballon_amounts_per = parseFloat(
      (parseFloat(ballon_amounts) * 100) / parseFloat(loan_amount)
      );
  }
}
jQuery("#ballon_amounts_per").val(Math.round(ballon_amounts_per));
document.getElementById("ballon_amount_range").value = ballon_amounts_per;
jQuery("#bill_ballon_per").val(ballon_amounts_per);
jQuery("#bill_ballon_amt").html(ballon_amounts);
jQuery("#bill_ballon_per").html(ballon_amounts_per);
jQuery("#ballon_amounts_per_dis").text(ballon_amounts_per + "%");
loan_calculation_process();
});

    /* END : Textbox Blur Event*/

var loan_amount_range = document.getElementById("loan_amount_range");
jQuery("#loan_amount").val(addCommas(loan_amount_range.value)); // Display the default slider value
if (setting_data.remove_decimal_point == 1) {
  var value = parseInt(
    ((loan_amount_range.value - loan_amount_range.min) /
      (loan_amount_range.max - loan_amount_range.min)) *
    100
    );
} else {
  var value = parseFloat(
    ((loan_amount_range.value - loan_amount_range.min) /
      (loan_amount_range.max - loan_amount_range.min)) *
    100
    );
}
loan_amount_range.style.background =
"linear-gradient(to right, #555555 0%, #555555 " +
value +
"%, #fff " +
value +
"%, " +
setting_data.back_ground_color +
" 100%)";

    // Update the current slider value (each time you drag the slider handle)
loan_amount_range.oninput = function () {
  jQuery("#loan_amount").val(addCommas(this.value));
  if (setting_data.disable_ballon_amt !== "1") {
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    if (
      parseFloat(ballon_amount_range.value) == 0 ||
      parseInt(ballon_amount_range.value) == 0
      ) {
      document.getElementById("ballon_amounts").value = 0 + "%";
    document.getElementById("ballon_amounts_per").value = 0 + "%";
    document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
  }
}

loan_calculation_process();
};

var loan_terms_range = document.getElementById("loan_terms_range");

  jQuery("#loan_terms").val(loan_terms_range.value); // Display the default slider value
  if (setting_data.remove_decimal_point == 1) {
    var value = parseInt(
      ((loan_terms_range.value - loan_terms_range.min) /
        (loan_terms_range.max - loan_terms_range.min)) *
      100
      );
  } else {
    var value = parseFloat(
      ((loan_terms_range.value - loan_terms_range.min) /
        (loan_terms_range.max - loan_terms_range.min)) *
      100
      );
  }
  loan_terms_range.style.background =
  "linear-gradient(to right, #555555 0%, #555555 " +
  value +
  "%, #fff " +
  value +
  "%, white 100%)";
  
    // Update the current slider value (each time you drag the slider handle)
  loan_terms_range.oninput = function () {

    jQuery("#loan_terms").val(this.value);
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((this.value - this.min) / (this.max - this.min)) * 100
        );
    } else {
      var value = parseFloat(
        ((this.value - this.min) / (this.max - this.min)) * 100
        );
    }
    if (setting_data.disable_ballon_amt !== "1") {
      var ballon_amount_range = document.getElementById(
        "ballon_amount_range"
        );
      if (
        parseFloat(ballon_amount_range.value) == 0 ||
        parseInt(ballon_amount_range.value) == 0
        ) {
        document.getElementById("ballon_amounts").value = 0 + "%";
      document.getElementById("ballon_amounts_per").value = 0 + "%";
      document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
    }
  }

  this.style.background =
  "linear-gradient(to right, #555555 0%, #555555 " +
  value +
  "%, #fff " +
  value +
  "%, white 100%)";

  loan_calculation_process();
};

loan_terms_range.onchange = function () {



  jQuery("#loan_terms").val(this.value);
  if (setting_data.remove_decimal_point == 1) {
    var value = parseInt(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );
  } else {
    var value = parseFloat(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );
  }
  if (setting_data.disable_ballon_amt !== "1") {
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    if (
      parseFloat(ballon_amount_range.value) == 0 ||
      parseInt(ballon_amount_range.value) == 0
      ) {
      document.getElementById("ballon_amounts").value = 0 + "%";
    document.getElementById("ballon_amounts_per").value = 0 + "%";
    document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
  }
}
this.style.background =
"linear-gradient(to right, #555555 0%, #555555 " +
value +
"%, #fff " +
value +
"%, white 100%)";

loan_calculation_process();
};

var interest_rate_range = document.getElementById("interest_rate_range");
if (setting_data.remove_decimal_point == 1) {
  var interest_rate_range_val = parseInt(interest_rate_range.value);
  jQuery("#interest_rates").val(interest_rate_range_val);
} else {
  var interest_rate_range_val = parseFloat(interest_rate_range.value);
  jQuery("#interest_rates").val(interest_rate_range_val.toFixed(2));
}
jQuery("#interest_rate_range_dis").html(
  interest_rate_range.value + "%"
  );
if (setting_data.remove_decimal_point == 1) {
  var value = parseInt(
    ((interest_rate_range.value - interest_rate_range.min) /
      (interest_rate_range.max - interest_rate_range.min)) *
    100
    );
} else {
  var value = parseFloat(
    ((interest_rate_range.value - interest_rate_range.min) /
      (interest_rate_range.max - interest_rate_range.min)) *
    100
    );
}
interest_rate_range.style.background =
"linear-gradient(to right, #555555 0%, #555555 " +
value +
"%, #fff " +
value +
"%, white 100%)";
    // Update the current slider value (each time you drag the slider handle)
interest_rate_range.oninput = function () {
  var interest_rate_range_val = this.value;
  jQuery("#interest_rates").val(interest_rate_range_val);
  jQuery("#interest_rate_range_dis").html(this.value + "%");
  if (setting_data.remove_decimal_point == 1) {
    var value = parseInt(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );
  } else {
    var value = parseFloat(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );
  }
  if (setting_data.disable_ballon_amt !== "1") {
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    if (
      parseFloat(ballon_amount_range.value) == 0 ||
      parseInt(ballon_amount_range.value) == 0
      ) {
      document.getElementById("ballon_amounts").value = 0 + "%";
    document.getElementById("ballon_amounts_per").value = 0 + "%";
    document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
  }
}

this.style.background =
"linear-gradient(to right, #555555 0%, #555555 " +
value +
"%, #fff " +
value +
"%, white 100%)";
loan_calculation_process();
};

var ballon_amount_range = document.getElementById("ballon_amount_range");
jQuery("#ballon_amounts_per").val(ballon_amount_range.value);
jQuery("#ballon_amounts_per_dis").html(ballon_amount_range.value + "%");
if (setting_data.remove_decimal_point == 1) {
  var value = parseInt(
    ((ballon_amount_range.value - ballon_amount_range.min) /
      (ballon_amount_range.max - ballon_amount_range.min)) *
    100
    );
} else {
  var value = parseFloat(
    ((ballon_amount_range.value - ballon_amount_range.min) /
      (ballon_amount_range.max - ballon_amount_range.min)) *
    100
    );
}
ballon_amount_range.style.background =
"linear-gradient(to right, #555555 0%, #555555 " +
value +
"%, #fff " +
value +
"%, white 100%)";

    // Update the current slider value (each time you drag the slider handle)
ballon_amount_range.oninput = function (e) {      
  if (jQuery("#extra_payment").length) {
    jQuery("#extra_payment").val(0);   
    jQuery("#extra_payment_range").val(0);   
  }
  jQuery("#ballon_amounts_per").val(this.value);
  jQuery("#ballon_amounts_per_dis").html(this.value + "%");
  if (setting_data.remove_decimal_point == 1) {
    value = parseInt(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );
  } else {
    value = parseFloat(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );
  }
  this.style.background =
  "linear-gradient(to right, #555555 0%, #555555 " +
  value +
  "%, #fff " +
  value +
  "%, white 100%)";
  loan_calculation_process();
};  


var loan_terms = document.getElementById("loan_terms");

loan_terms.onchange = function () {
  if (setting_data.remove_decimal_point == 1) {
    var value = parseInt(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );
  } else {
    var value = parseFloat(
      ((this.value - this.min) / (this.max - this.min)) * 100
      );
  }
    // this.style.background = 'linear-gradient(to right, #555555 0%, #555555 ' + value + '%, #fff ' + value + '%, white 100%)'
  if (setting_data.disable_ballon_amt !== "1") {
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    var ballon_amount_range = document.getElementById(
      "ballon_amount_range"
      );
    if (
      parseFloat(ballon_amount_range.value) == 0 ||
      parseInt(ballon_amount_range.value) == 0
      ) {
      document.getElementById("ballon_amounts").value = 0 + "%";
    document.getElementById("ballon_amounts_per").value = 0 + "%";
    document.getElementById("ballon_amounts_per_dis").text = 0 + "%";
  }
}
    // this.style.background = 'linear-gradient(to right, #555555 0%, #555555 ' + value + '%, #fff ' + value + '%, white 100%)'
loan_calculation_process();
};

    /******************|| Print Code || **********************/

      /* fixed issue of chart in print start */

//    jQuery(".print-table").click(function () {    

//       var graphW = jQuery('#loan-process-graph').attr('width');     

//       if(graphW == '0'){
//        graphW = 540;
//        jQuery('#loan-process-graph').prop('width',graphW);
//        jQuery('#loan-process-graph').prop('height',graphW);        
//       }

//     printJS({
//             printable: 'main-sec',
//             type: 'html',
//             targetStyles: ['*'], 
//             css: setting_data.font_awesome_css_url /* require to load font awesome icons */
//          });

//    });

function switchTab(tabId) {
  if (tabId === 'tab1') {
    jQuery('#tab1').prop('checked', true).trigger('click');
  } else if (tabId === 'tab2') {
    jQuery('#tab1').prop('checked', true).trigger('click');
    setTimeout(function() {
      jQuery('#tab2').prop('checked', true).trigger('click');
    }, 10);
  } else if (tabId === 'tab3') {
    jQuery('#tab1').prop('checked', true).trigger('click');
    setTimeout(function() {
      jQuery('#tab3').prop('checked', true).trigger('click');
    }, 10);
  }
}

/*jQuery(".print-table").on('click', function () {
  jQuery('#overlay').show();
  
  var selectedTabIds = jQuery('input[name="tabs"]:checked').attr('id');
  switchTab(selectedTabIds);

  jQuery("#main-sec").css({
    "@media print": {
      "@page": { size: "297mm 420mm" },
      "-webkit-print-color-adjust": "exact !important",
      "-moz-print-color-adjust": "exact !important",
      "-ms-print-color-adjust": "exact !important",
      "print-color-adjust": "exact !important",
      "color-adjust": "exact !important"
    }
  });

  setTimeout(function() {
    jQuery('#overlay').hide();
    jQuery("#main-sec").print();
  }, 50);
});*/

jQuery('.print-table').on('click', function () {
  window.print();
});

// Optional: Show loader when input focus out
jQuery('input[name="tabs"]').on('focusout', function () {
  jQuery('#overlay').show();
});
jQuery('input:radio[name="tabs"]').on('change',function() {          
  loan_calculation_process();
});

       /* fixed issue of chart in print end */

    // Attach change event handler to the payment_type dropdown
$("#payment_type").change(function () {
    // Call loan_calculation_process when the dropdown changes
  loan_calculation_process();
});



$(document).on("input", "#repayment_freq", function () {

  var repayment_freq = jQuery("#repayment_freq option:selected").val();

  var old_repayment_freq = jQuery(
    "input[name='current_repayment_freq']"
    ).val();

  var default_nop_value = jQuery("input[name='loan_terms']").val();

    /* nop = number of payments */
  var min_nop_value = jQuery("input[name='min_value']").val();

  var max_nop_value = jQuery("input[name='max_value']").val();


  var numbers_of_payments = cal_numbers_of_payment_by_frequency_val(
    repayment_freq,
    old_repayment_freq,
    default_nop_value,
    min_nop_value,
    max_nop_value
    );

    /*set payments range and min / max values in input range*/
  jQuery("#loan_terms_range").attr(
    "value",
    numbers_of_payments.nop_default_value
    );
  jQuery("#loan_terms_range").attr(
    "min",
    numbers_of_payments.nop_min_value
    );
  jQuery("#loan_terms_range").attr(
    "max",
    numbers_of_payments.nop_max_value
    );


  jQuery("#loan_terms").val(numbers_of_payments.nop_default_value);

  jQuery("input[name='min_value']").val(numbers_of_payments.nop_min_value);
  jQuery("input[name='max_value']").val(numbers_of_payments.nop_max_value);
  jQuery("input[name='default_value']").val(
    numbers_of_payments.nop_default_value
    );

    /*reset range slider after select payment frequency option last changes*/
  document.getElementById("loan_terms_range").value =
  numbers_of_payments.nop_default_value;

  var loan_terms_range = document.getElementById("loan_terms_range");
  var value1 =
  ((numbers_of_payments.nop_default_value -
    numbers_of_payments.nop_min_value) /
  (numbers_of_payments.nop_max_value -
    numbers_of_payments.nop_min_value)) *
  100;

  loan_terms_range.style.background =
  "linear-gradient(to right, #555555 0%, #555555 " +
  value1 +
  "%, #fff " +
  value1 +
  "%,  #c9a208 100%)";

  loan_calculation_process();
});


    /* down payment event code start */

if (setting_data.down_payment_option == '1') {



       /* check if down payment value entered */
 jQuery("#down_payment").on("blur", function () {         

  if(setting_data.down_payment_mode=='percentage'){           

    var down_payment_range = document.getElementById("down_payment_range");
    if (parseFloat(down_payment_range.value) == 0 || parseInt(down_payment_range.value) == 0 ) {
      document.getElementById("down_payment").value = 0 ;
      document.getElementById("down_payment_per").value = 0 + "%";
      document.getElementById("down_payment_per_dis").text = 0 + "%";
    }
    var down_payment = $(this).val();
    var down_payment_per = jQuery("#down_payment_per").val();
    down_payment_range.value = down_payment_per;
    var loan_amount = jQuery("#loan_amount").val();
    loan_amount = loan_amount.replaceAll(",", "");

    if (down_payment == "" || down_payment == ".") {
      jQuery("#down_payment").val(0);
    }

    down_payment = down_payment.replaceAll(",", "");

    if (down_payment == "" || down_payment == ".") {
      down_payment = 0;
      down_payment_per = 0;
    } else {
      if (setting_data.remove_decimal_point == 1) {
        var down_payment_per = parseInt(
          (parseInt(down_payment) * 100) / parseInt(loan_amount)
          );
      } else {
        var down_payment_per = parseFloat(
          (parseFloat(down_payment) * 100) / parseFloat(loan_amount)
          );
      }
    }
    jQuery("#down_payment_per").val(Math.round(down_payment_per));
    document.getElementById("down_payment_range").value = down_payment_per;
    jQuery("#down_payment_per").val(down_payment_per);

    jQuery("#bottom_down_payment").html(down_payment);
    jQuery("#bottom_down_payment_per").html(down_payment_per);


  }
  else{ 

    var down_payment = $(this).val();
    var loan_amount = jQuery("#loan_amount").val();

    down_payment = down_payment.replaceAll(",", "");
    loan_amount = loan_amount.replaceAll(",", "");

    if (setting_data.remove_decimal_point == 1) {

      var eighty_percent_loan_amt =   (parseInt(loan_amount) * parseInt(setting_data.down_payment_max_per))/100;  
      down_payment = parseInt(down_payment);
      if(down_payment>eighty_percent_loan_amt){

        jQuery(this).val(0);

      }
      else{

        jQuery(this).val(parseInt(down_payment));

        jQuery("#bottom_down_payment").html(parseInt(down_payment));

      }             

    }
    else{

      var eighty_percent_loan_amt =   (parseFloat(loan_amount) * parseInt(setting_data.down_payment_max_per))/100;  
      down_payment = parseFloat(down_payment);
      if(down_payment>eighty_percent_loan_amt){
        jQuery(this).val(0.00);

      }
      else{

        jQuery(this).val(addCommas(parseInt(down_payment)));

        jQuery("#bottom_down_payment").html(addCommas(parseInt(down_payment)));

      }
    }


    loan_calculation_process();

  }


});       




 if(setting_data.down_payment_mode=='percentage'){ 

        /* check if down payment per changed */

  jQuery("#down_payment_per").on("blur", function () {  


    jQuery(this).val(parseInt(jQuery(this).val()));

    if(parseInt(jQuery(this).val()) > setting_data.down_payment_max_per){

      if (setting_data.remove_decimal_point == 1) {
        jQuery(this).val(0);
      }
      else{
        jQuery(this).val(0.00);
      }
    }


    var currency_symbol = setting_data.currency_symbols;
    jQuery("#down_payment_range").val(
      jQuery("#down_payment_per").val().replaceAll("%", "")
      );
    var loan_amount = jQuery("#loan_amount")
    .val()
    .replaceAll(currency_symbol, "");
    loan_amount = loan_amount.replaceAll(",", "");
    var down_payment_per = jQuery("#down_payment_per")
    .val()
    .replaceAll("%", "");

    if (setting_data.remove_decimal_point == 1) {

      var down_payment =
      parseInt(parseInt(loan_amount) * parseInt(down_payment_per)) / 100;
    } else {
      var down_payment =
      parseFloat(parseFloat(loan_amount) * parseFloat(down_payment_per)) /
      100;
    }

    if (down_payment_per == "" || down_payment_per == ".") {
      jQuery("#down_payment_per").val("0%");
      jQuery("#down_payment_range").val(0);
      down_payment_per = 0;
    }


    jQuery("#down_payment").val(down_payment);
    jQuery("#bottom_down_payment").html(down_payment);


    jQuery("#down_payment_per_dis").html(down_payment_per + "%");
    loan_calculation_process();

  });    



  var down_payment_range = document.getElementById("down_payment_range");
  jQuery("#down_payment_per").val(down_payment_range.value);
  jQuery("#down_payment_per_dis").html(down_payment_range.value + "%");
  if (setting_data.remove_decimal_point == 1) {
    var value = parseInt(
      ((down_payment_range.value - down_payment_range.min) /
        (down_payment_range.max - down_payment_range.min)) *
      100
      );
  } else {
    var value = parseFloat(
      ((down_payment_range.value - down_payment_range.min) /
        (down_payment_range.max - down_payment_range.min)) *
      100
      );
  }
  down_payment_range.style.background =
  "linear-gradient(to right, #555555 0%, #555555 " +
  value +
  "%, #fff " +
  value +
  "%, white 100%)";

        // Update the current slider value (each time you drag the slider handle)
  down_payment_range.oninput = function (e) {

    jQuery("#down_payment_per").val(this.value);
    jQuery("#down_payment_per_dis").html(this.value + "%");
    if (setting_data.remove_decimal_point == 1) {
      value = parseInt(
        ((this.value - this.min) / (this.max - this.min)) * 100
        );
    } else {
      value = parseFloat(
        ((this.value - this.min) / (this.max - this.min)) * 100
        );
    }
    this.style.background =
    "linear-gradient(to right, #555555 0%, #555555 " +
    value +
    "%, #fff " +
    value +
    "%, white 100%)";
    loan_calculation_process();
  };  

}


}

     /* down payment event code end */  


     /* extra payment event code start */ 

if (setting_data.extra_payment_option == '1') {      

       /* check if down payment value entered */
 jQuery("#extra_payment").on("blur", function () {
  if (jQuery("#ballon_amounts").length) {
    jQuery("#ballon_amounts").val(0);
    jQuery("#ballon_amounts_per").val(0);   
    jQuery("#ballon_amount_range").val(0);   
  }
  var extra_payment = $(this).val();
  var loan_amount = jQuery("#loan_amount").val();

  extra_payment = extra_payment.replaceAll(",", "");
  loan_amount = loan_amount.replaceAll(",", "");  
  var extra_payment_max_per = parseInt(setting_data.extra_payment_max_per);

  var extra_payment_max_val = parseInt((parseInt(loan_amount) * extra_payment_max_per) / 100);            

  extra_payment = parseInt(extra_payment);
  if(extra_payment>extra_payment_max_val){
    jQuery(this).val(0);
    document.getElementById("extra_payment_range").value = 0;             
  }
  else{
    jQuery(this).val(addCommas(parseInt(extra_payment))); 
    jQuery("#bottom_extra_payment").html(extra_payment);
    document.getElementById("extra_payment_range").value = extra_payment;
  } 

  loan_calculation_process();

});


 var extra_payment_range = document.getElementById("extra_payment_range");
 jQuery("#extra_payment").val(addCommas(extra_payment_range.value));


 var value = parseInt(
  ((extra_payment_range.value - extra_payment_range.min) /
    (extra_payment_range.max - extra_payment_range.min)) *
  100
  );

 extra_payment_range.style.background =
 "linear-gradient(to right, #555555 0%, #555555 " +
 value +
 "%, #fff " +
 value +
 "%, white 100%)";

      // Update the current slider value (each time you drag the slider handle)
 extra_payment_range.oninput = function (e) {
  if (jQuery("#ballon_amounts").length) {
    jQuery("#ballon_amounts").val(0);
    jQuery("#ballon_amounts_per").val(0);   
    jQuery("#ballon_amount_range").val(0);   
  }
  jQuery("#extra_payment").val(addCommas(this.value));       

  value = parseInt(
    ((this.value - this.min) / (this.max - this.min)) * 100
    );        

  this.style.background =
  "linear-gradient(to right, #555555 0%, #555555 " +
  value +
  "%, #fff " +
  value +
  "%, white 100%)";
  loan_calculation_process();
};

}   

     /* extra payment event code end */

    loan_calculation_process();


  } /********** END: This condition for Default theme and New theme change *************/
  }); //End jQuery(document).ready(function ($)

  /* START : Add Commas in amonut function*/
function addCommas(nStr) {
  nStr += "";
  var x = nStr.split(".");
  var x1 = x[0];
  var x2 = x.length > 1 ? "." + x[1] : "";
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, "$1" + "," + "$2");
  }
  return x1 + x2;
}

  /* START : Validation for only enter number with some special charcter */
function onlyNos(evt, txt_name) {
  var theEvent = evt || window.event;
  var key = theEvent.keyCode || theEvent.which;
  var keyCode = key;
  key = String.fromCharCode(key);
  
  if (keyCode == 37 || keyCode == 39) {
    return;
  }
  
  if (keyCode == 67 || keyCode == 86 || keyCode == 88 || keyCode == 65) {
    return;
  }
  
  if (
    theEvent.key == "!" ||
    theEvent.key == "@" ||
    theEvent.key == "#" ||
    theEvent.key == "$" ||
    theEvent.key == "&" ||
    theEvent.key == "%" ||
    theEvent.key == "^" ||
    theEvent.key == "*" ||
    theEvent.key == ")" ||
    theEvent.key == "("
    ) {
    return false;
}
var txt_value = jQuery("#" + txt_name).val();
if (
  txt_value.length >= 1 &&
  txt_value.charAt(0) == "." &&
  theEvent.key == "."
  ) {
  return false;
}

if (key.length == 0) return;
var regex = /^[0-9.,\b]+$/;
if (
  keyCode == 188 ||
  keyCode == 190 ||
  keyCode == 110 ||
  keyCode == 9 ||
  (keyCode >= 96 && keyCode <= 105)
  ) {
  return;
} else {
  if (!regex.test(key)) {
    theEvent.returnValue = false;
    if (theEvent.preventDefault) theEvent.preventDefault();
  }
}
}

function validateInputLoanRate(input) {
  var value = parseFloat(input.value);
  
  // Check if the value is a number and within the specified range
  if (isNaN(value) || value < 0) {
    // Display an error message or take appropriate action
    console.log(
      "Invalid input. Please enter a number greater than or equal to 0."
      );
  } else if (value > setting_data.loan_amount_max_value) {
    // Truncate the value to 100 if it exceeds the maximum allowed
    input.value = setting_data.loan_amount_max_value;
    document.getElementById("loan_amount").textContent = input.value;
  } else {
    // Update the hidden span element with the valid value
    document.getElementById("loan_amount").textContent = value;
  }
}


function convert_total_terms_to_year_month(loan_terms,repayment_frequency_val){ 


  var years = 0;
  var months = 0; 
  var remains = 0; 
  var old_loan_terms = loan_terms;


  if (setting_data.extra_payment_option == '1' && parseInt(jQuery('#extra_payment').val().replaceAll(",", "")) > 0) {      

      loan_terms = parseInt(jQuery('#loan_table_data tr.emi-row').length); 

  }

  
  if(repayment_frequency_val == "Weekly"){  


    years = parseInt(loan_terms / 52);

    remains = loan_terms - (years * 52);

    months = parseInt(remains / 4);


  }
  else if(repayment_frequency_val == "Fortnight"){

    years = parseInt(loan_terms / 26);

    remains = loan_terms - (years * 26);

    months = parseInt(remains / 2);   

  }
  else if(repayment_frequency_val == "Monthly"){    

    years = parseInt(loan_terms / 12);

    remains = loan_terms - (years * 12);    

    months = parseInt(remains); 
  }
  else if(repayment_frequency_val == "Quarterly"){

    years = parseInt(loan_terms / 4);

    remains = loan_terms - (years * 4);   

    months = parseInt(remains * 3); 

  }
  else if(repayment_frequency_val == "Yearly"){

    years = parseInt(loan_terms);   
    months = 0;

  }   
  

  if(months <= 0){

      if(years<=0){

        var display_year_months_loan_det_sec = "";
      }
      else{

        var display_year_months_loan_det_sec = years + " <label>"+setting_data.year_label+" </label>";
     
      }

  }
  else{

    if(years<=0){
      var display_year_months_loan_det_sec = months + " <label>"+setting_data.month_label+" </label>"; 
    }
    else{
      var display_year_months_loan_det_sec = years + " <label>"+setting_data.year_label+" </label>" + months + " <label>"+setting_data.month_label+" </label>"; 
    }

  }


  jQuery('#loan_amount_year').html(display_year_months_loan_det_sec);


  jQuery("#total_interests_years").html(display_year_months_loan_det_sec);


  /* extra payment display saved time in result summary start */

  if (setting_data.extra_payment_option == '1' && parseInt(jQuery('#extra_payment').val().replaceAll(",", "")) > 0) {

      var saved_loan_terms = parseInt(old_loan_terms) - parseInt(loan_terms);

        if(repayment_frequency_val == "Weekly"){  


        years = parseInt(saved_loan_terms / 52);

        remains = saved_loan_terms - (years * 52);

        months = parseInt(remains / 4);


        }
        else if(repayment_frequency_val == "Fortnight"){

        years = parseInt(saved_loan_terms / 26);

        remains = saved_loan_terms - (years * 26);

        months = parseInt(remains / 2);   

        }
        else if(repayment_frequency_val == "Monthly"){    

        years = parseInt(saved_loan_terms / 12);

        remains = saved_loan_terms - (years * 12);    

        months = parseInt(remains); 
        }
        else if(repayment_frequency_val == "Quarterly"){

        years = parseInt(saved_loan_terms / 4);

        remains = saved_loan_terms - (years * 4);   

        months = parseInt(remains * 3); 

        }
        else if(repayment_frequency_val == "Yearly"){

        years = parseInt(saved_loan_terms);   
        months = 0;

        }  
         

        if(months <= 0){

          if(years<=0){
            
            jQuery('#extra_payment_saved_time_section').hide();

          } 
          else{
             
            jQuery('#extra_payment_saved_time_section').show();  
            var display_year_months_loan_det_sec = years + " <label>"+setting_data.year_label+" </label>";
          
          }     


        }
        else{

            jQuery('#extra_payment_saved_time_section').show();                

            if(years <=0){

              var display_year_months_loan_det_sec = months + " <label>"+setting_data.month_label+" </label>"; 
            }
            else{
              var display_year_months_loan_det_sec = years + " <label>"+setting_data.year_label+" </label>" + months + " <label>"+setting_data.month_label+" </label>"; 
            }
        }  

        
        if (setting_data.hide_save_time_extra_payments != '1'){

          jQuery('#time_save_for_extra_payment').html(display_year_months_loan_det_sec); 

        }       


    }  


    /* extra payment display saved time in result summary end */


}


function convert_total_terms_to_year_month_for_loan_term_frequency_label(loan_terms,repayment_frequency_val){ 


  var years = 0;
  var months = 0; 
  var remains = 0; 

  
  if(repayment_frequency_val == "Weekly"){  


    years = parseInt(loan_terms / 52);

    remains = loan_terms - (years * 52);

    months = parseInt(remains / 4);


  }
  else if(repayment_frequency_val == "Fortnight"){

    years = parseInt(loan_terms / 26);

    remains = loan_terms - (years * 26);

    months = parseInt(remains / 2);   

  }
  else if(repayment_frequency_val == "Monthly"){    

    years = parseInt(loan_terms / 12);

    remains = loan_terms - (years * 12);    

    months = parseInt(remains); 
  }
  else if(repayment_frequency_val == "Quarterly"){

    years = parseInt(loan_terms / 4);

    remains = loan_terms - (years * 4);   

    months = parseInt(remains * 3); 

  }
  else if(repayment_frequency_val == "Yearly"){

    years = parseInt(loan_terms);   
    months = 0;

  } 


  var display = years + " year(s) and " + months + " month(s)"; 

  jQuery('#label-for-freuency').text(display); 


}

function get_total_interest_without_extra_payment(){

    var monthly_payment = 0;
    var repayment_frequency_val = jQuery("#repayment_freq").val();   


    var loan_amount = jQuery("#loan_amount").val();
    if (setting_data.remove_decimal_point == 1) {
      loan_amount = parseInt(loan_amount.replaceAll(",", ""));
    } else {
      loan_amount = parseFloat(loan_amount.replaceAll(",", ""));
    }


    /* down payment code start */

    if (setting_data.down_payment_option == '1') {


      if (setting_data.down_payment_mode == 'percentage') {        

        var down_payment_range = document.getElementById("down_payment_range");   
        

        var down_payment_per = jQuery("#down_payment_per").val();

        
        down_payment_per = parseInt(down_payment_per);
       
        
        var down_payment =
        parseInt(
          (parseInt(loan_amount) *
            parseInt(down_payment_per)
            )) / 100;

        loan_amount = loan_amount - parseInt(down_payment);            


      }
      else{

        var down_payment = parseInt(jQuery("#down_payment").val().replaceAll(",", ""));     

        
        if (down_payment >  0 && down_payment < loan_amount) { 

          loan_amount = loan_amount - parseInt(down_payment);

        }

      }      


      if (down_payment == "") {
        down_payment = 0;
      }     

    }   

    /* down payment code end */     

    if (setting_data.remove_decimal_point == 1) {
      var interest_rates = parseInt(jQuery("#interest_rates").val());
    } else {
      var interest_rates = parseFloat(jQuery("#interest_rates").val());
    }

    var ballon_amounts_per = jQuery("#ballon_amounts_per").val();
    var loan_terms_month = 0;
    var total_months_terms = 0;  

    var loan_terms = parseFloat(jQuery("#loan_terms").val()); 


    if (loan_terms > 0) {
      total_months_terms = cal_loan_terms_by_frequency_payment_option(
        repayment_frequency_val,
        loan_terms
        );
      loan_terms_month = loan_terms;
    }   

    
    var payment_type = jQuery("#payment_type").val();
    var loan_advance_interest = 0;
    var adloan_amount = 0;
    if (payment_type == "In Advance") {
      if (setting_data.remove_decimal_point == 1) {
        adloan_amount = cal_advance_loan_amount_by_frequency_val(
          repayment_frequency_val,
          loan_amount,
          interest_rates
          );
        var advance_cal = loan_advance_interest_cal(
          repayment_frequency_val,
          adloan_amount,
          interest_rates
          );
        loan_advance_interest = parseInt(advance_cal.loan_advance_interest);
        loan_amount = adloan_amount;
      } else {
        adloan_amount = cal_advance_loan_amount_by_frequency_val(
          repayment_frequency_val,
          loan_amount,
          interest_rates
          );
        var advance_cal = loan_advance_interest_cal(
          repayment_frequency_val,
          adloan_amount,
          interest_rates
          );
        loan_advance_interest = advance_cal.loan_advance_interest;
        loan_amount = adloan_amount;
      }
    }

    if (setting_data.remove_decimal_point == 1) {
      var ballon_amounts =
      parseInt(
        (parseInt(loan_amount) + parseInt(loan_advance_interest)) *
        parseInt(ballon_amounts_per)
        ) / 100;
      
    } else {
      var ballon_amounts =
      parseFloat(
        (parseFloat(loan_amount) + parseFloat(loan_advance_interest)) *
        parseFloat(ballon_amounts_per)
        ) / 100;    
      
    }
    

    if (parseFloat(ballon_amounts) > parseFloat(loan_amount)) {
      if (setting_data.remove_decimal_point == 1) {
        var new_ballon_amt =
        parseInt(
          (parseInt(loan_amount) + parseInt(loan_advance_interest)) *
          parseInt(ballon_amounts_per)
          ) / 100;
        
      } else {
        var new_ballon_amt =
        parseFloat(
          (parseFloat(loan_amount) + parseFloat(loan_advance_interest)) *
          parseFloat(ballon_amounts_per)
          ) / 100;        
      }
    }

    var ballon_amounts = jQuery("#ballon_amounts").val();
    ballon_amounts = ballon_amounts.replaceAll(",", "");
    if (ballon_amounts == "") {
      ballon_amounts = 0;
    }
    
    if (setting_data.remove_decimal_point == 1) {
      ballon_amounts_per = parseInt(ballon_amounts_per);
      
    } else {
      ballon_amounts_per = parseFloat(ballon_amounts_per);      
    }

    var loan_amount_range = document.getElementById("loan_amount_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((loan_amount_range.value - loan_amount_range.min) /
          (loan_amount_range.max - loan_amount_range.min)) *
        100
        );
    } else {
      var value =
      ((loan_amount_range.value - loan_amount_range.min) /
        (loan_amount_range.max - loan_amount_range.min)) *
      100;
    }
    

    var interest_rate_range = document.getElementById("interest_rate_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((interest_rate_range.value - interest_rate_range.min) /
          (interest_rate_range.max - interest_rate_range.min)) *
        100
        );
    } else {
      var value =
      ((interest_rate_range.value - interest_rate_range.min) /
        (interest_rate_range.max - interest_rate_range.min)) *
      100;
    }
    

    var loan_terms_range = document.getElementById("loan_terms_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((loan_terms_range.value - loan_terms_range.min) /
          (loan_terms_range.max - loan_terms_range.min)) *
        100
        );
    } else {
      var value =
      ((loan_terms_range.value - loan_terms_range.min) /
        (loan_terms_range.max - loan_terms_range.min)) *
      100;
    }
    

    var ballon_amount_range = document.getElementById("ballon_amount_range");
    if (setting_data.remove_decimal_point == 1) {
      var value = parseInt(
        ((ballon_amount_range.value - ballon_amount_range.min) /
          (ballon_amount_range.max - ballon_amount_range.min)) *
        100
        );
      
      loan_terms = parseInt(loan_terms / 12);
      loan_terms = parseInt(loan_terms);
    } else {      
      loan_terms = parseFloat(loan_terms / 12).toFixed(2);
      loan_terms = parseFloat(loan_terms);
    }

    
    
    if (setting_data.remove_decimal_point == 1) {
      var emi_cal = cal_emi_amount_frequency_payment_options(
        repayment_frequency_val,
        loan_amount,
        interest_rates,
        loan_terms_month,
        ballon_amounts
        );

      monthly_payment = parseInt(emi_cal.emi_amount);

      var total_interests =
      parseInt(monthly_payment) * loan_terms_month - loan_amount;
      var per_month_ballon_amt = 0;
      var ballon_amt_interest = 0;  
      

      if (ballon_amounts > 0) {     


        ballon_amt_interest = cal_total_interest_on_balloon_amount(repayment_frequency_val,ballon_amounts,interest_rates,loan_terms_month);       
          per_month_ballon_amt = ballon_amt_interest / loan_terms_month;
      }
    } else {

      var emi_cal = cal_emi_amount_frequency_payment_options(
        repayment_frequency_val,
        loan_amount,
        interest_rates,
        loan_terms_month,
        ballon_amounts
        );

      monthly_payment = emi_cal.emi_amount;

      var total_interests = (monthly_payment * loan_terms_month) - loan_amount;     

      var per_month_ballon_amt = 0;
      var ballon_amt_interest = 0;

      if (ballon_amounts > 0) {


        ballon_amt_interest = cal_total_interest_on_balloon_amount(repayment_frequency_val,ballon_amounts,interest_rates,loan_terms_month);
        per_month_ballon_amt = ballon_amt_interest / loan_terms_month;
      }
    }

    var loan_terms = jQuery("#loan_terms").val();

    if (setting_data.remove_decimal_point == 1) { 


      if(repayment_frequency_val=='Fortnight'){


        loan_terms = parseInt(loan_terms / 26);

      }
      else if(repayment_frequency_val=='Weekly'){


        loan_terms = parseInt(loan_terms / 52);

      }
      else{

       loan_terms = parseInt(loan_terms / 12);

     }


     loan_terms = parseInt(loan_terms);

     total_interests =
     parseInt(total_interests) +
     parseInt(ballon_amounts) +
     parseInt(ballon_amt_interest);
     monthly_payment =
     parseInt(monthly_payment) + parseInt(per_month_ballon_amt);   


   } else {  


    if(repayment_frequency_val=='Fortnight'){


      loan_terms = parseFloat(loan_terms / 26).toFixed(2);

    }
    else if(repayment_frequency_val=='Weekly'){


      loan_terms = parseFloat(loan_terms / 52).toFixed(2);          

    }
    else{

      loan_terms = parseFloat(loan_terms / 12).toFixed(2);             

    }

    loan_terms = parseFloat(loan_terms);
    total_interests =
    parseFloat(total_interests) +
    parseFloat(ballon_amounts) +
    parseFloat(ballon_amt_interest) * loan_terms;
    monthly_payment =
    parseFloat(monthly_payment) + parseFloat(per_month_ballon_amt);


  }
  
  /* START: Total Fee Calculation */  

  /* check for the inifinity and NAN value */

  if(monthly_payment==Infinity || monthly_payment =='NaN' || Number.isNaN(monthly_payment) == Number.isNaN(NaN)){
    monthly_payment = 0;
  }

  jQuery("#loan_terms_range").val(jQuery("#loan_terms").val());
  var monthly_fee = setting_data.monthly_rate;
  var application_fee = setting_data.application_fee;
  if (setting_data.calculation_fee_setting_enable == 1) {
    if (setting_data.remove_decimal_point == 1) {

      var loan_terms_for_fee = 0 ;


      if(repayment_frequency_val=='Fortnight'){


        loan_terms_for_fee = parseInt(loan_terms * 26 / 12);

      }
      else if(repayment_frequency_val=='Weekly'){


       loan_terms_for_fee = parseInt(loan_terms * 52 / 26);

     }
     else{


      loan_terms_for_fee = parseInt(loan_terms)

    }


    var total_regular_fee_amt = parseInt(loan_terms_for_fee) * 120;
    total_regular_fee_amt = parseInt(total_regular_fee_amt).toFixed(2);
    jQuery("#total_regular_fee_amt").html(total_regular_fee_amt);

    var total_fee =
    parseInt(application_fee) + parseInt(total_regular_fee_amt);
    jQuery("#total_fee_amt").html(total_fee);


  } else {

    var loan_terms_for_fee = 0 ;


    if(repayment_frequency_val=='Fortnight'){


      loan_terms_for_fee = parseFloat(loan_terms * 26 / 12).toFixed(2);

    }
    else if(repayment_frequency_val=='Weekly'){


      loan_terms_for_fee = parseFloat(loan_terms * 52 / 12).toFixed(2);         

    }
    else{

      loan_terms_for_fee = parseFloat(loan_terms).toFixed(2);
    }

    var total_regular_fee_amt = parseFloat(loan_terms_for_fee) * 120;
    total_regular_fee_amt = parseFloat(total_regular_fee_amt).toFixed(2); 
    
    var total_fee =
    parseFloat(application_fee) + parseFloat(total_regular_fee_amt);
    
  }
}
/* END : Total Fee Calculation*/

/* STRAT : Interests Field Fill*/



    //var loan_amount_term_label = 'per ' + repayment_frequency_val.slice(0, -2) + ' for ';
var loan_amount_term_label = "";
if (repayment_frequency_val == "Yearly") {
  loan_amount_term_label = setting_data.repay_freq_per_year_label;
} else if (repayment_frequency_val == "Quarterly") {
  loan_amount_term_label = setting_data.repay_freq_per_quarter_label;
} else if (repayment_frequency_val == "Weekly") {
  loan_amount_term_label = setting_data.repay_freq_per_week_label;
} else if (repayment_frequency_val == "Fortnight") {
  loan_amount_term_label = setting_data.repay_freq_per_fortnight_label;
} else {
  loan_amount_term_label = setting_data.repay_freq_per_month_label;
}



if (setting_data.remove_decimal_point == 1) {  

  var total_int_amt = addCommas(
    Math.round(
      parseInt(total_interests) - parseInt(loan_advance_interest)
      )
    );  

      /* check for NAN value */

  if(total_int_amt=='NaN'){
    total_int_amt = 0;
  }   

  return total_int_amt;


} else {
  
    if (interest_rates === 0) {   

      return 0;

    } else {


      var total_sum_interests =
      total_interests < loan_advance_interest
      ? parseFloat(total_interests).toFixed(2)
        
      : 
        (
          parseFloat(total_interests) -
          parseFloat(loan_advance_interest)
          ).toFixed(2)
        ;      


      /* check for NAN value */ 
      if(total_sum_interests=='NaN'){
        total_sum_interests = '0.00';
      }    

       return total_sum_interests;  

    }   

  }    

}


jQuery(document).ready(function() {
  jQuery('#loan_terms').on('focusout', function() {
    function switchTabs(tabId) {
      if (tabId === 'tab1') {
        jQuery('#tab1').prop('checked', true).trigger('click');
      } else if (tabId === 'tab2') {
        jQuery('#tab1').prop('checked', true).trigger('click');
        setTimeout(function() {
          jQuery('#tab2').prop('checked', true).trigger('click');
        }, 5);
      } else if (tabId === 'tab3') {
        jQuery('#tab1').prop('checked', true).trigger('click');
        setTimeout(function() {
          jQuery('#tab3').prop('checked', true).trigger('click');
        }, 5);
      }
    }

    // Show loader and overlay
    jQuery('#overlay').show();
    jQuery('#loader').show();

    setTimeout(function() {
      var selectedTabId = jQuery('input[name="tabs"]:checked').attr('id');
      switchTabs(selectedTabId);
      setTimeout(function() {
        jQuery('#overlay').hide();
        jQuery('#loader').hide();
      }, 15);
    }, 10);
  });
  var theme = jQuery('body').data('theme');
  var printStyles = '';

  if (theme === 'twenty-twenty-four') {
    printStyles = `
    @media print {
      .loan-option-text-info .loan-option-text-info-section .loan-option-text-info-block .first-row .first-row-sub-child {
        width: 30% !important;
        padding: 0 15px !important;
        position: relative !important;
      }
    }
    `;
  } else {
    printStyles = `
    @media print {
      .loan-option-text-info .loan-option-text-info-section .loan-option-text-info-block .first-row .first-row-sub-child {
        width: 33.33% !important;
        padding: 0 15px !important;
        position: relative !important;
      }
    }
    `;
  }
  jQuery('<style>' + printStyles + '</style>').appendTo('head');
});
jQuery('select').on('change',function(e){
 jQuery(this).find('[selected]').removeAttr('selected')
 jQuery(this).find(':selected').attr('selected','selected')
});


/* new stacked bar chart */

  const getOrCreateLegendList = (chart, id) => {
    const legendContainer = document.getElementById(id);
    let listContainer = legendContainer.querySelector('ul');

    if (!listContainer) {
      listContainer = document.createElement('ul');
      listContainer.style.display = 'flex';
      listContainer.style.flexDirection = 'row';
      listContainer.style.margin = 0;
      listContainer.style.padding = 0;

      legendContainer.appendChild(listContainer);
    }

    return listContainer;
  };

  const htmlLegendPlugin = {
    id: 'htmlLegend',
    afterUpdate(chart, args, options) {
      const ul = getOrCreateLegendList(chart, options.containerID);

      // Remove old legend items
      while (ul.firstChild) {
        ul.firstChild.remove();
      }
      
      const items = chart.options.plugins.legend.labels.generateLabels(chart);   

      var bal_val;

      Object.entries(items).forEach(([key, value]) => {

        if(value.text=='Balance'){
          bal_val = value; 
          delete items[key];
        }

      });

      items.push(bal_val);

      items.forEach(item => {
        const li = document.createElement('li');
        li.style.alignItems = 'center';
        li.style.cursor = 'pointer';
        li.style.display = 'flex';
        li.style.flexDirection = 'row';
        li.style.marginLeft = '10px';

        li.onclick = () => {
          const {type} = chart.config;
          if (type === 'pie' || type === 'doughnut') {
            // Pie and doughnut charts only have a single dataset and visibility is per item
            chart.toggleDataVisibility(item.index);
          } else {
            chart.setDatasetVisibility(item.datasetIndex, !chart.isDatasetVisible(item.datasetIndex));
          }
          chart.update();
        };      

        // Color box
        const boxSpan = document.createElement('span');
        boxSpan.style.background = item.fillStyle;
        boxSpan.style.borderColor = item.strokeStyle;
        boxSpan.style.borderWidth = '0px';
        boxSpan.style.display = 'inline-block';
        boxSpan.style.flexShrink = 0;
        boxSpan.style.height = '14px';
        boxSpan.style.marginRight = '10px';
        boxSpan.style.width = '14px';      
        boxSpan.style.borderRadius = '50%';

        if(item.text == 'Balance'){
          boxSpan.classList.add('balance-legend-icon');
          boxSpan.style.height = '10px';
          boxSpan.style.width = '10px';  
          li.style.marginLeft = '15px';
        }

        // Text
        const textContainer = document.createElement('p');
        textContainer.style.color = item.fontColor;
        textContainer.style.margin = 0;
        textContainer.style.padding = 0;
        textContainer.style.textDecoration = item.hidden ? 'line-through' : '';

        if(jQuery(window).width() <= 767){
          textContainer.style.fontSize = '8px';
        }

        const text = document.createTextNode(item.text);
        textContainer.appendChild(text);

        li.appendChild(boxSpan);
        li.appendChild(textContainer);
        ul.appendChild(li);

        ul.style.justifyContent = 'center';

      });
    }
  };


